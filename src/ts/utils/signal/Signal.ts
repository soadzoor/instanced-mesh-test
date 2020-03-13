export interface ISignal
{
	add(listener: Function, listenerContext?: any): void;
	add(listener: Function, listenerContext?: any): void;
	addAndCall(listener: Function, listenerContext?: any): void;
	addOnce(listener: Function, listenerContext?: any): void;
	remove(listener: Function, listenerContext?: any): boolean;
	removeAll();
	halt();
	dispatch(...args: any[]): void;
	bindings: IBinding[];
}

export interface ISignalP0 extends ISignal
{
	add     (listener: () => void, listenerContext?: any);
	addOnce (listener: () => void, listenerContext?: any);
	remove  (listener: () => void, listenerContext?: any);
	dispatch();
}

/**
 * Signal with 1 parameter
 */
export interface ISignalP1<T1> extends ISignal
{
	add     (listener: (p1: T1) => void, listenerContext?: any, priority?: number);
	addOnce (listener: (p1: T1) => void, listenerContext?: any, priority?: number);
	remove  (listener: (p1: T1) => void, listenerContext?: any);
	dispatch(p1: T1);
}

/**
 * Signal with 2 parameters
 */
export interface ISignalP2<T1, T2> extends ISignal
{
	add     (listener: (p1: T1, p2: T2) => void, listenerContext?: any, priority?: number);
	addOnce (listener: (p1: T1, p2: T2) => void, listenerContext?: any, priority?: number);
	remove  (listener: (p1: T1, p2: T2) => void, listenerContext?: any);
	dispatch(p1: T1, p2: T2);
}

/**
 * Signal with 3 parameters
 */
export interface ISignalP3<T1, T2, T3> extends ISignal
{
	add     (listener: (p1: T1, p2: T2, p3: T3) => void, listenerContext?: any, priority?: number);
	addOnce (listener: (p1: T1, p2: T2, p3: T3) => void, listenerContext?: any, priority?: number);
	remove  (listener: (p1: T1, p2: T2, p3: T3) => void, listenerContext?: any);
	dispatch(p1: T1, p2: T2, p3: T3);
}

export interface IBinding
{
	listener: Function;
	context?: any;
	isOnce: boolean;
	priority: number;
}

export class Signal implements ISignal
{

	// --------------------------------------------------------------------------------------------------
	// static create method

	public static create()             : ISignalP0;
	public static create<T>()          : ISignalP1<T>;
	public static create<T0, T1>()     : ISignalP2<T0, T1>;
	public static create<T0, T1, T2>() : ISignalP3<T0, T1, T2>;

	public static create()
	{
		return new Signal();
	}


	// --------------------------------------------------------------------------------------------------
	// private members, constructor

	//protected _listeners: Function[];
	//protected _options: ISignalOption[];
	protected _bindings: IBinding[];

	protected _shouldPropagate = true;

	constructor()
	{
		this._bindings = [];
	}


	// --------------------------------------------------------------------------------------------------
	// add methods

	// TODO support addBefore?

	public add(listener: Function, context?: any, priority = 0)
	{
		this.registerListener(listener, false, context, priority);
	}

	public addAndCall(listener: Function, context?: any, priority = 0)
	{
		this.registerListener(listener, false, context, priority);

		context = context || this;
		listener.call(context);
	}

	public addOnce(listener: Function, context?: any, priority = 0)
	{
		this.registerListener(listener, true, context, priority);
	}

	protected registerListener(listener: Function, isOnce: boolean, context: any, priority: number = 0)
	{
		const prevIndex = this.indexOfListener(listener, context);
		let binding: IBinding = null;

		if (prevIndex !== -1)
		{
			binding = this._bindings[prevIndex];
			if (binding.isOnce !== isOnce)
			{
				throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
			}
		}
		else
		{
			binding = {
				listener : listener,
				context  : context,
				isOnce   : isOnce,
				priority : priority
			};

			this.addBinding(binding);
		}
	}

	protected addBinding(binding: IBinding)
	{
		let n = this._bindings.length;

		do
		{
			--n;
		}
		while (this._bindings[n] && binding.priority <= this._bindings[n].priority);

		this._bindings.splice(n+1, 0, binding);

		//if (this._highestPriority < binding.pr)
	}

	protected indexOfListener(listener: Function, context: any)
	{
		for (let i = this._bindings.length - 1; i >= 0; --i)
		{
			const binding = this._bindings[i];
			if (binding.listener === listener && binding.context === context)
			{
				return i;
			}
		}

		return -1;
	}

	// --------------------------------------------------------------------------------------------------
	// has

	public has()
	{

	}

	public halt()
	{
		this._shouldPropagate = false;
	}

	//--------------------------------------------------------------------------------------------------
	// remove Methods

	/**
	 * If context is given -> remove the matching listener with that context.
	 * If no context given -> remove all matching listeners (regardless of context).
	 *
	 * TODO return listener?
	 */
	public remove(listener: Function, context?: any)
	{
		const i = this.indexOfListener(listener, context);

		if (i !== -1)
		{
			this._bindings.splice(i, 1);
			return true;
		}

		return false;
	}

	public removeAll()
	{
		this._bindings.length = 0;
	}


	// --------------------------------------------------------------------------------------------------
	// dispatch

	public dispatch(...args)
	{
		const paramsArr = Array.prototype.slice.call(arguments);
		this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

		const bindings = this._bindings;
		// TODO
		// Clone array in case add/remove items during dispatch
		// Eg.: add a key listener in a key listener, in this case you
		// only want the listener to be triggered for the next key event, not the current one.
		// (although that isn't a problem because the for loop is decremental)
		// Another potential bug: when you remove the event listener with index 2 and 3 in the event listener
		// with index 3 -> in that case the next step in the for loop will try to access index 2 which
		// doesn't exist anymore.
		//
		// const bindings = this._bindings.slice();

		for (let i = bindings.length - 1; i >= 0; --i)
		{
			const result = bindings[i].listener.apply(bindings[i].context, paramsArr);

			if (result === false || !this._shouldPropagate)
			{
				break;
			}
		}
	}

	public dispose()
	{
		this.removeAll();
	}

	public get bindings()
	{
		return this._bindings;
	}

	// --------------------------------------------------------------------------------------------------
	// getters

	// public getListeners()
	// {
	// 	return this._listeners;
	// }
}
