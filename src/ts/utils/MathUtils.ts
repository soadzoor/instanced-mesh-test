export class MathUtils
{
	public static TWO_PI  = Math.PI * 2.0;
	public static PI_HALF = Math.PI / 2.0;

	public static DEG2RAD = Math.PI / 180.0;
	public static RAD2DEG = 180.0 / Math.PI;

	/**
	 * Returns if x is power of two (POT).
	 *
	 * Taken from https://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences
	 */
	public static isPowerOfTwo(x: number): boolean
	{
		return (x & (x - 1)) == 0;
	}

	/**
	 * Returns the next power of two number after x (or x if x is POT)
	 * eg.:
	 * 2 -> 2
	 * 3 -> 4
	 * 5 -> 8
	 *
	 * Taken from https://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences
	 *
	 * Note this only works for integers (not for 4.7).
	 *
	 */
	public static nextHighestPowerOfTwo(x: number): number
	{
		--x;
		for (let i = 1; i < 32; i <<= 1)
		{
			x = x | x >> i;
		}
		return x + 1;
	}

	// TODO this could be optimized
	public static previousHighestPowerOfTwo(x: number): number
	{
		if (x < 1)
		{
			return 0;
		}

		const nextHighestPowerOfTwo = MathUtils.nextHighestPowerOfTwo(x);

		if (nextHighestPowerOfTwo === x)
		{
			return nextHighestPowerOfTwo;
		}
		else
		{
			return nextHighestPowerOfTwo / 2;
		}
	}

	public static isWholeNum(value: number)
	{
		return value > 0 || value === 0;
	}

	public static isValidNumber(value: number)
	{
		if (value === null)      return false;
		if (value === undefined) return false;
		if (isNaN(value))        return false;
		if (value === Infinity)  return false;
		if (value === -Infinity) return false;

		return true;
	}

	public static validate(value: number, defaultValue = 0)
	{
		if (isFinite(value) && (typeof value === "number"))
		{
			return value;
		}

		return defaultValue;
	}

	/**
	 * Wraps the given angle (in radian) in the range of (-PI, PI]
	 * theta = theta - 2PI * floor( (theta+PI) / 2PI )
	 *
	 * Not the same!
	 * TODO check with 184.9990156656489
	 * same as:
	 * (((theta % 2PI) + 3PI) % 2PI) - PI
	 * (((a % 360) + 540) % 360) - 180
	 */
	public static wrapPi(theta: number): number
	{
		if (Math.abs(theta) > Math.PI)
		{
			const revolutions = Math.floor( (theta + Math.PI) * (1.0 / MathUtils.TWO_PI) );
			theta -= revolutions * MathUtils.TWO_PI;
		}

		return theta;
	}

	//public static angleDiff(a: number, b: number): number
	//{
	//	return MathUtils.NormalizeAngle(a-b);
	//}

	/**
	 * Composes a value with the magnitude of x and the sign of y.
	 */
	public static copySign(x: number, y: number): number
	{
		return Math.abs(x) * Math.sign(y);
	}

	/**
	 * Returns and angle between -180 and 180
	 */
	//public static NormalizeAngle(a: number): number
	//{
	//	return (((a % 360) + 540) % 360) - 180;
	//
	//	// TODO This version caused problems for Walls!
	//	//return a - this.TWO_PI * Math.floor((a + this.PI) / this.TWO_PI);
	//}

	/**
	 * If min/max is undefined, it is not constrained.
	 */
	public static clamp(x: number, min: number | undefined, max: number | undefined): number
	{
		return x < min ? min : (x > max ? max : x);
	}

	// Takes the modulus of x, returning it to the range of [0, total-1]
	// http://javascript.about.com/od/problemsolving/a/modulobug.htm
	public static mod(x: number, n: number)
	{
		return ((x % n) + n) % n;
	}

	public static setPrecision(x: number, precision: number = 2): number
	{
		precision = Math.pow(10, precision);
		return (Math.round(x * precision) / precision);
	}

	

	// Fits size around availableSize while keeping the ratio of size.
	public static fitAroundSize(size: number[], availableSize: number[], result: number[] = []): number[]
	{
		const sizeRatio      = size[0] / size[1];
		const availableRatio = availableSize[0] / availableSize[1];

		if (sizeRatio > availableRatio)
		{
			// size is wider than availableSize -> availableSize.height is the limit

			result[1] = availableSize[1];
			result[0] = result[1] * sizeRatio;
		}
		else
		{
			result[0] = availableSize[0];
			result[1] = result[0] / sizeRatio;
		}

		return result;
	}

	/**
	 * `x` should be between `a` and `b`.
	 * The result will be between 0 and 1, keeping the proper ratios of `x` to `a` and `b`
	 */
	public static getInterpolation(x: number, a: number, b: number)
	{
		return ((x - a) / (b - a));
	}

	public static getNewRandomGUID()
	{
		return (
			Math.random().toString(36).substring(2, 15) +
			Math.random().toString(36).substring(2, 15)
		);
	}

	public static getShortNameForUnit(unitName: string)
	{
		switch (unitName)
		{
			case "Inch":
				return `"`;
			case "Foot":
				return `'`;
			case "Millimeter":
				return "mm";
			case "Centimeter":
				return "cm";
			case "Meter":
				return "m";
			default:
				return null;
		}
	}

	public static getPluralNameForUnit(unitName: string)
	{
		switch (unitName)
		{
			case "Inch":
				return "Inches";
			case "Foot":
				return "Feet";
			default:
				return `${unitName}s`;
		}
	}
}