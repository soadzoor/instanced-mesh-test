export class ConversionUtils
{
	public static buildQueryString(values: any[], leadingChar = "#"): string
	{
		let result = leadingChar;

		for (let i = 0; i < values.length; i += 2)
		{
			if (i > 0)
			{
				result += "&";
			}

			const key = values[i];
			let value = values[i + 1];

			if (typeof value === "number")
			{
				value = value.toString();
			}

			result += encodeURIComponent(key) + "=" + encodeURIComponent(value);
		}

		return result;
	}

	public static htmlEncode(values: any, leadingChar = "#"): string
	{
		let result = leadingChar;
		let first = true;

		for (const key in values)
		{
			if (!first)
			{
				result += "&";
			}
			else
			{
				first = false;
			}

			let value = values[key];
			if (typeof value === "number")
			{
				value = value.toString();
			}

			result += encodeURIComponent(key) + "=" + encodeURIComponent(value);
		}

		return result;
	}

	public static htmlDecode(value: string, leadingChar = true): any
	{
		if (!value)
		{
			return null;
		}

		if (leadingChar)
		{
			value = value.substr(1);
			if (!value)
			{
				return;
			}
		}

		const value_split = value.split("&");

		const result = {};

		for (let i = 0, ln = value_split.length; i < ln; ++i)
		{
			const value_split_split = value_split[i].split("=");

			let key = value_split_split[0];
			let val = value_split_split[1];

			// or replace(/\+/g, "%20")
			key = key.split("+").join("%20");
			val = val ? val.split("+").join("%20") : "";

			key = decodeURIComponent(key);
			val = decodeURIComponent(val);

			result[key] = val;
		}

		return result;
	}
}
