package dev.slimevr.unit

import com.jme3.math.FastMath
import dev.slimevr.VRServer.Companion.getNextLocalTrackerId
import dev.slimevr.tracking.trackers.Tracker
import dev.slimevr.tracking.trackers.udp.IMUType
import io.github.axisangles.ktmath.EulerAngles
import io.github.axisangles.ktmath.EulerOrder
import io.github.axisangles.ktmath.Quaternion
import org.junit.jupiter.api.AssertionFailureBuilder
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import kotlin.math.*

/**
 * Tests [TrackerResetsHandler.resetMounting]
 *
 * Head rotation does not get reset.
 * Tracker yaw is set to head yaw on reset.
 */
class MountingResetTests {

	@TestFactory
	fun testResetAndMounting(): List<DynamicTest> = directions.flatMap { e ->
		directions.map { m ->
			DynamicTest.dynamicTest(
				"Full and Mounting Reset Test of Tracker (Expected: ${deg(e)}, reference: ${deg(m)})",
			) {
				checkResetMounting(e, m)
			}
		}
	}

	private fun checkResetMounting(expected: Quaternion, reference: Quaternion) {
		// Compute the pitch/roll for the expected mounting
		val trackerRot = (expected * (frontRot / expected))

		val tracker = Tracker(
			null,
			getNextLocalTrackerId(),
			"test",
			"test",
			null,
			hasRotation = true,
			imuType = IMUType.UNKNOWN,
			needsReset = true,
			needsMounting = true,
		)

		// Apply full reset and mounting
		tracker.setRotation(Quaternion.IDENTITY)
		tracker.resetsHandler.resetFull(Quaternion.IDENTITY)
		tracker.setRotation(trackerRot)
		tracker.resetsHandler.resetMounting(Quaternion.IDENTITY)

		val expectedYaw = yaw(expected)
		val resultYaw = yaw(tracker.resetsHandler.mountRotFix)
		assertAnglesApproxEqual(
			expectedYaw,
			resultYaw,
			"Resulting mounting yaw after full reset is not equal to reference yaw (${deg(expectedYaw)} vs ${deg(resultYaw)})",
		)

		// Apply full reset and mounting plus offset
		tracker.setRotation(Quaternion.IDENTITY)
		tracker.resetsHandler.resetFull(reference)
		// Apply an offset of reference to the rotation
		tracker.setRotation(reference * trackerRot)
		// Since reference is the offset from quat identity (reset) and the rotation,
		// it needs to be applied twice
		tracker.resetsHandler.resetMounting(reference * reference)

		val expectedYaw2 = yaw(expected)
		val resultYaw2 = yaw(tracker.resetsHandler.mountRotFix)
		assertAnglesApproxEqual(
			expectedYaw2,
			resultYaw2,
			"Resulting mounting yaw after full reset with offset is not equal to reference yaw (${deg(expectedYaw2)} vs ${deg(resultYaw2)})",
		)

		// Apply yaw reset and mounting
		tracker.setRotation(Quaternion.IDENTITY)
		tracker.resetsHandler.resetFull(reference)
		tracker.resetsHandler.resetYaw(Quaternion.IDENTITY)
		tracker.setRotation(trackerRot)
		tracker.resetsHandler.resetMounting(Quaternion.IDENTITY)

		val expectedYaw3 = yaw(expected)
		val resultYaw3 = yaw(tracker.resetsHandler.mountRotFix)
		assertAnglesApproxEqual(
			expectedYaw3,
			resultYaw3,
			"Resulting mounting yaw after yaw reset is not equal to reference yaw (${deg(expectedYaw3)} vs ${deg(resultYaw3)})",
		)

		// Apply yaw reset and mounting plus offset
		tracker.setRotation(Quaternion.IDENTITY)
		tracker.resetsHandler.resetFull(Quaternion.IDENTITY)
		tracker.resetsHandler.resetYaw(reference)
		// Apply an offset of reference to the rotation
		tracker.setRotation(reference * trackerRot)
		// Since reference is the offset from quat identity (reset) and the rotation,
		// it needs to be applied twice
		tracker.resetsHandler.resetMounting(reference * reference)

		val expectedYaw4 = yaw(expected)
		val resultYaw4 = yaw(tracker.resetsHandler.mountRotFix)
		assertAnglesApproxEqual(
			expectedYaw3,
			resultYaw3,
			"Resulting mounting yaw after yaw reset with offset is not equal to reference yaw (${deg(expectedYaw4)} vs ${deg(resultYaw4)})",
		)
	}

	@Test
	fun testYawAfter() {
		val expected = Quaternion.SLIMEVR.RIGHT
		val reference = EulerAngles(EulerOrder.YZX, FastMath.PI / 8f, FastMath.HALF_PI, 0f).toQuaternion()
		// Compute the pitch/roll for the expected mounting
		val trackerRot = (expected * (frontRot / expected))

		val tracker = Tracker(
			null,
			getNextLocalTrackerId(),
			"test",
			"test",
			null,
			hasRotation = true,
			imuType = IMUType.UNKNOWN,
			needsReset = true,
			needsMounting = true,
		)

		// Apply full reset and mounting
		tracker.setRotation(Quaternion.IDENTITY)
		tracker.resetsHandler.resetFull(Quaternion.IDENTITY)
		tracker.setRotation(trackerRot)
		tracker.resetsHandler.resetMounting(Quaternion.IDENTITY)

		val expectedYaw = yaw(expected)
		val resultYaw = yaw(tracker.resetsHandler.mountRotFix)
		assertAnglesApproxEqual(
			expectedYaw,
			resultYaw,
			"Resulting mounting yaw after full reset is not equal to reference yaw (${deg(expectedYaw)} vs ${deg(resultYaw)})",
		)

		tracker.setRotation(reference * reference)
		tracker.resetsHandler.resetYaw(reference)

		val expectedYaw2 = yaw(reference)
		val resultYaw2 = yaw(tracker.getRotation())
		assertAnglesApproxEqual(
			expectedYaw2,
			resultYaw2,
			"Resulting rotation after yaw reset is not equal to reference yaw (${deg(expectedYaw2)} vs ${deg(resultYaw2)})",
		)
	}

	/**
	 * Makes a radian angle positive
	 */
	private fun posRad(rot: Float): Float {
		// Reduce the rotation to the smallest form
		val redRot = rot % FastMath.TWO_PI
		return abs(if (rot < 0f) FastMath.TWO_PI + redRot else redRot)
	}

	/**
	 * Gets the yaw of a rotation in radians
	 */
	private fun yaw(rot: Quaternion): Float = posRad(rot.toEulerAngles(EulerOrder.YZX).y)

	/**
	 * Converts radians to degrees
	 */
	private fun deg(rot: Float): Float = rot * FastMath.RAD_TO_DEG

	private fun deg(rot: Quaternion): Float = deg(yaw(rot))

	private fun anglesApproxEqual(a: Float, b: Float): Boolean = FastMath.isApproxEqual(a, b) ||
		FastMath.isApproxEqual(a - FastMath.TWO_PI, b) ||
		FastMath.isApproxEqual(a, b - FastMath.TWO_PI)

	private fun assertAnglesApproxEqual(expected: Float, actual: Float, message: String?) {
		if (!anglesApproxEqual(expected, actual)) {
			AssertionFailureBuilder.assertionFailure().message(message)
				.expected(expected).actual(actual).buildAndThrow()
		}
	}

	companion object {
		val directions = arrayOf(
			Quaternion.SLIMEVR.FRONT,
			Quaternion.SLIMEVR.FRONT_LEFT,
			Quaternion.SLIMEVR.LEFT,
			Quaternion.SLIMEVR.BACK_LEFT,
			Quaternion.SLIMEVR.FRONT_RIGHT,
			Quaternion.SLIMEVR.RIGHT,
			Quaternion.SLIMEVR.BACK_RIGHT,
			Quaternion.SLIMEVR.BACK,
		)

		val frontRot = EulerAngles(EulerOrder.YZX, FastMath.HALF_PI, 0f, 0f).toQuaternion()
	}
}
