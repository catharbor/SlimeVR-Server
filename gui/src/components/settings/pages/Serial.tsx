import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import {
  CloseSerialRequestT,
  OpenSerialRequestT,
  RpcMessage,
  SerialDevicesRequestT,
  SerialDevicesResponseT,
  SerialDeviceT,
  SerialTrackerFactoryResetRequestT,
  SerialTrackerGetInfoRequestT,
  SerialTrackerRebootRequestT,
  SerialUpdateResponseT,
  SerialTrackerGetWifiScanRequestT,
} from 'solarxr-protocol';
import { useElemSize, useLayout } from '@/hooks/layout';
import { useWebsocketAPI } from '@/hooks/websocket-api';
import { Button } from '@/components/commons/Button';
import { Dropdown } from '@/components/commons/Dropdown';
import { Typography } from '@/components/commons/Typography';
import { Localized, useLocalization } from '@fluent/react';
import { BaseModal } from '@/components/commons/BaseModal';
import { WarningBox } from '@/components/commons/TipBox';
import { useBreakpoint } from '@/hooks/breakpoint';
import { Input } from '@/components/commons/Input';
import { SerialTrackerCommandRequestT } from 'solarxr-protocol/protocol/typescript/dist/solarxr-protocol/rpc/serial-tracker-command-request';

export interface SerialForm {
  port: string;
}

interface SerialInputForm {
  command: string;
}

export function Serial() {
  const {
    layoutHeight,
    layoutWidth,
    ref: consoleRef,
  } = useLayout<HTMLDivElement>();
  const { isMobile } = useBreakpoint('mobile');
  const { l10n } = useLocalization();
  const { state } = useLocation();

  const toolbarRef = useRef<HTMLDivElement>(null);
  const { height } = useElemSize(toolbarRef);

  const { useRPCPacket, sendRPCPacket } = useWebsocketAPI();
  // const consoleRef = useRef<HTMLPreElement>(null);
  const [consoleContent, setConsole] = useState('');

  const [isSerialOpen, setSerialOpen] = useState(false);
  const [serialDevices, setSerialDevices] = useState<
    Omit<SerialDeviceT, 'pack'>[]
  >([]);

  const [tryFactoryReset, setTryFactoryReset] = useState(false);

  const defaultValues = { port: 'Auto' };
  const { control, watch, handleSubmit, reset } = useForm<SerialForm>({
    defaultValues,
  });

  const { port } = watch();

  useEffect(() => {
    const subscription = watch(() => handleSubmit(onSubmit)());
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = (value: SerialForm) => {
    openSerial(value.port);
    setConsole('');
  };

  const openSerial = (port: string) => {
    sendRPCPacket(RpcMessage.CloseSerialRequest, new CloseSerialRequestT());
    const req = new OpenSerialRequestT();
    req.auto = port === 'Auto';
    req.port = port;
    sendRPCPacket(RpcMessage.OpenSerialRequest, req);
  };

  const {
    reset: resetInput,
    control: controlInput,
    handleSubmit: handleSubmitInput,
    formState,
  } = useForm<SerialInputForm>({
    defaultValues: { command: '' },
  });

  const onSubmitInput = (value: SerialInputForm) => {
    const command = value.command.trim();
    if (command === '') {
      return;
    }

    sendCommand(command);

    resetInput();
  };

  useEffect(() => {
    sendRPCPacket(RpcMessage.SerialDevicesRequest, new SerialDevicesRequestT());
    const typedState: { serialPort: string } = state as any;
    if (typedState?.serialPort) {
      reset({ port: typedState.serialPort });
    }
  }, []);

  useEffect(() => {
    return () => {
      sendRPCPacket(RpcMessage.CloseSerialRequest, new CloseSerialRequestT());
    };
  }, []);

  useRPCPacket(
    RpcMessage.SerialUpdateResponse,
    (data: SerialUpdateResponseT) => {
      if (data.closed) {
        setSerialOpen(false);
      } else {
        setSerialOpen(true);
      }

      if (data.log && consoleRef.current) {
        setConsole((console) => console + data.log);
      }
    }
  );

  useRPCPacket(
    RpcMessage.SerialDevicesResponse,
    (res: SerialDevicesResponseT) => {
      setSerialDevices([
        {
          name: l10n.getString('settings-serial-auto_dropdown_item'),
          port: 'Auto',
        },
        ...(res.devices || []),
      ]);
    }
  );

  useEffect(() => {
    if (consoleRef.current)
      consoleRef.current.scrollTo({
        top: consoleRef.current.scrollHeight,
      });
  }, [consoleContent]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!isSerialOpen) {
        openSerial(port ?? defaultValues.port);
      } else {
        clearInterval(id);
      }
    }, 3000);

    return () => {
      clearInterval(id);
    };
  }, [isSerialOpen]);

  const reboot = () => {
    sendRPCPacket(
      RpcMessage.SerialTrackerRebootRequest,
      new SerialTrackerRebootRequestT()
    );
  };
  const factoryReset = () => {
    sendRPCPacket(
      RpcMessage.SerialTrackerFactoryResetRequest,
      new SerialTrackerFactoryResetRequestT()
    );

    setTryFactoryReset(false);
  };
  const getInfos = () => {
    sendRPCPacket(
      RpcMessage.SerialTrackerGetInfoRequest,
      new SerialTrackerGetInfoRequestT()
    );
  };
  const getWifiScan = () => {
    sendRPCPacket(
      RpcMessage.SerialTrackerGetWifiScanRequest,
      new SerialTrackerGetWifiScanRequestT()
    );
  };
  const sendCommand = (command: string) => {
    sendRPCPacket(
      RpcMessage.SerialTrackerCommandRequest,
      new SerialTrackerCommandRequestT(command)
    );
  };

  return (
    <>
      <BaseModal
        isOpen={tryFactoryReset}
        onRequestClose={() => setTryFactoryReset(false)}
      >
        <Localized
          id="settings-serial-factory_reset-warning"
          elems={{ b: <b></b> }}
        >
          <WarningBox>
            <b>Warning:</b> This will reset the tracker to factory settings.
            Which means Wi-Fi and calibration settings <b>will all be lost!</b>
          </WarningBox>
        </Localized>
        <div className="flex flex-row gap-3 pt-5 place-content-center">
          <Button variant="secondary" onClick={() => setTryFactoryReset(false)}>
            {l10n.getString('settings-serial-factory_reset-warning-cancel')}
          </Button>
          <Button variant="primary" onClick={factoryReset}>
            {l10n.getString('settings-serial-factory_reset-warning-ok')}
          </Button>
        </div>
      </BaseModal>
      <div className="flex flex-col bg-background-70 h-full p-5 rounded-md">
        <div className="flex flex-row mobile:flex-col pb-2 justify-between">
          <div className="flex flex-col">
            <Typography variant="main-title">
              {l10n.getString('settings-serial')}
            </Typography>
            <>
              {l10n
                .getString('settings-serial-description')
                .split('\n')
                .map((line, i) => (
                  <Typography color="secondary" key={i}>
                    {line}
                  </Typography>
                ))}
            </>
          </div>
          <div className="flex flex-wrap gap-2 mobile:grid mobile:grid-cols-2 mobile:grid-rows-2 items-end justify-end">
            <Button variant="tertiary" onClick={reboot}>
              {l10n.getString('settings-serial-reboot')}
            </Button>
            <Button variant="tertiary" onClick={() => setTryFactoryReset(true)}>
              {l10n.getString('settings-serial-factory_reset')}
            </Button>
            <Button variant="tertiary" onClick={getInfos}>
              {l10n.getString('settings-serial-get_infos')}
            </Button>
            <Button variant="tertiary" onClick={getWifiScan}>
              {l10n.getString('settings-serial-get_wifi_scan')}
            </Button>
            {isMobile && (
              <Dropdown
                control={control}
                name="port"
                display="block"
                placeholder={l10n.getString('settings-serial-serial_select')}
                items={serialDevices.map((device) => ({
                  label: device.name?.toString() || 'error',
                  value: device.port?.toString() || 'error',
                }))}
              ></Dropdown>
            )}
          </div>
        </div>

        <div className="bg-background-80 rounded-lg flex flex-col p-2">
          <div
            ref={consoleRef}
            className="overflow-x-auto overflow-y-auto"
            style={{
              height: layoutHeight - height - 30 - (isMobile ? 88 : 0),
              width: layoutWidth - 24,
            }}
          >
            <div className="flex select-text px-3">
              <pre>
                {isSerialOpen
                  ? consoleContent
                  : l10n.getString('settings-serial-connection_lost')}
              </pre>
            </div>
          </div>
          <div className="" ref={toolbarRef}>
            <div className="border-t-2 pt-2  border-background-60 border-solid m-2 gap-2 flex flex-row">
              <form
                className="w-full flex flex-row gap-2"
                onSubmit={handleSubmitInput(onSubmitInput)}
              >
                <div className="flex-grow h-full">
                  <Input
                    name="command"
                    type="text"
                    control={controlInput}
                    placeholder={l10n.getString(
                      'settings-serial-serial_command_input'
                    )}
                  />
                </div>
                {isMobile && (
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={formState.isSubmitting}
                  >
                    {l10n.getString('settings-serial-serial_command_submit')}
                  </Button>
                )}
              </form>

              {!isMobile && (
                <div className="text-nowrap">
                  <Dropdown
                    control={control}
                    name="port"
                    display="fit"
                    placeholder={l10n.getString(
                      'settings-serial-serial_select'
                    )}
                    items={serialDevices.map((device) => ({
                      label: device.name?.toString() || 'error',
                      value: device.port?.toString() || 'error',
                    }))}
                  ></Dropdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
