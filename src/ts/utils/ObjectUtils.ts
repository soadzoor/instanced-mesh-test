export class ObjectUtils
{
	/*
	 static merge(targetObject, sourceObject)
	 {
	 for (const key in sourceObject)
	 {
	 targetObject[key] = sourceObject[key];
	 }
	 return targetObject;
	 }
	 */

	public static deepClone<T>(source: T): T
	{
		return JSON.parse(JSON.stringify(source));
	}

	public static clone<T>(source: T, deep = false): T
	{
		if (typeof source !== "object" || source === null)
		{
			return source;
		}

		const target = <T> (Array.isArray(source) ? [] : {});

		for (const key in source)
		{
			target[key] = deep ? ObjectUtils.clone(source[key], true) : source[key];
		}

		return target;
	}

	static apply<T extends Object>(target: T, source: any)
	{
		for (const key in source)
		{
			target[key] = source[key];
		}

		return target;
	}

	static mergeConfig<T extends Object>(defaultConfig: T, config: T): T
	{
		// Object.create makes a shallow copy
		const resultConfig = Object.create(defaultConfig);

		for (const key in config)
		{
			const value = config[key];
			resultConfig[key] = value;
		}

		return resultConfig;
	}

	static parseById(config: any, recursionDepth: number = -1)
	{
		for (const key in config)
		{
			const configValue = config[key];

			if (Array.isArray(configValue) && key.substr(-2) === "_a")
			{
				const objectsById = {};

				for (let i = 0, ln = configValue.length; i < ln; i++)
				{
					const array_element = configValue[i];
					if (typeof array_element === "object" && array_element.id)
					{
						objectsById[array_element.id] = array_element;
						if (--recursionDepth) // falsy <=> 0 (negative is truthy)
						{
							ObjectUtils.parseById(array_element, recursionDepth);
						}
					}
				}

				if (Object.keys(objectsById).length)
				{
					configValue[key + "_o"] = objectsById;
				}
			}
		}
	}

	private static keys(object: any)
	{
		// NOT WORKING FOR File type!
		// const keys = Object.keys(object);
		const keys = [];
		for (let key in object)
		{
			keys.push(key);
		}

		return keys;
	}

	/**
	 * Checks if 2 objects equal each other, ie. they have the same
	 * fields and values (recursively).
	 */
	static compare(object1, object2): boolean
	{
		if (object1 === object2)
		{
			// same instance or same value for primitive types
			// -> no need to check further
			return true;
		}

		const type1 = typeof object1;
		const type2 = typeof object2;

		if (type1 !== type2)
		{
			// types don't match
			return false;
		}

		if (type1 !== "object")
		{
			// they're both primitive types but don't have the same value (first if in this function)
			return false;
		}

		// at this point types match, they're not primitives, but they're not the same instance
		// -> check if all the properties have the same value

		// first check if they have the same keys
		// (note: objects can be either object or array)

		const keys1 = ObjectUtils.keys(object1);
		const keys2 = ObjectUtils.keys(object2);
		

		if (keys1.length !== keys2.length)
		{
			return false;
		}

		keys1.sort();
		keys2.sort();

		for (let i = 0, ln = keys1.length; i < ln; ++i)
		{
			if (keys1[i] !== keys2[i])
			{
				// key names don't match
				return false;
			}
		}

		// they have the same keys
		// check if they have the same values for each key
		for (let i = 0, ln = keys1.length; i < ln; ++i)
		{
			const key = keys1[i];

			if (!ObjectUtils.compare(object1[key], object2[key]))
			{
				// values don't match
				return false;
			}
		}

		// match

		return true;
	}
}
