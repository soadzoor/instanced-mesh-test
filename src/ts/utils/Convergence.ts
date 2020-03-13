import {MathUtils} from "three";
import {SceneManager} from "../view/SceneManager";
import {Constants} from "./Constants";

/** This class is mainly for animating anything seamlessly and smoothly.
 *  If you modify the "end", end you keep calling "update", then "start" will get closer and closer to the value of "end"
 *  The higher the dampingFactor is, the faster the "animation" is. It should be between 0 and 1.*/

export enum Easing
{
	EASE_OUT,
	EASE_IN_OUT
}

export class Convergence
{
	private static _activeInstances: Convergence[] = [];
	private _timeStampAtSetEnd: number = 0;
	protected _originalStart: number;
	protected _originalEnd: number;
	protected _start: number;
	protected _end: number;
	protected _min: number = -Infinity;
	protected _max: number = Infinity;
	private _value: number; // current value (between start and end)
	private _animationDuration: number; // ms
	private _originalAnimationDuration: number; // ms
	private _hasChanged: boolean = false;
	private _prevDeltaValue: number = 0;
	private _prevTimeStamp: number = 1;
	private _prevDeltaTime: number = 1;
	private _easing: Easing = Easing.EASE_OUT;
	private _timeoutID: number = -1;
	private _triggerRender: boolean;

	constructor(start: number, end: number, easing: Easing = Easing.EASE_OUT, animationDuration: number = Constants.DURATIONS.DEFAULT_ANIMATION, triggerRender: boolean = true)
	{
		this._originalStart = start;
		this._start = start;
		this._originalEnd = end;
		this._end = end;
		this._value = this._start;
		this._originalAnimationDuration = this._animationDuration = animationDuration;
		this._easing = easing;
		this._triggerRender = triggerRender;
	}

	private static removeFromActiveOnes(convergenceToRemove: Convergence)
	{
		Convergence._activeInstances = Convergence._activeInstances.filter((convergence: Convergence) => convergence !== convergenceToRemove);
	}

	private static addToActiveOnes(convergenceToAdd: Convergence)
	{
		if (!Convergence._activeInstances.includes(convergenceToAdd))
		{
			Convergence._activeInstances.push(convergenceToAdd);
		}
	}

	public static updateActiveOnes(timeStamp: number)
	{
		let triggerRender = false;
		for (const c of Convergence._activeInstances)
		{
			triggerRender = triggerRender || c._triggerRender;
			c.update(timeStamp);
		}

		return triggerRender;
	}

	private smoothStep(elapsedTime: number)
	{
		if (elapsedTime < this._animationDuration)
		{
			const x = elapsedTime / this._animationDuration;

			return MathUtils.clamp((x**2)*(3 - 2*x)*(this._end - this._start) + this._start, this._min, this._max);
		}
		else
		{
			this._end = MathUtils.clamp(this._end, this._min, this._max);
			return this._end;
		}
	}

	private exponentialOut(elapsedTime: number)
	{
		if (elapsedTime < this._animationDuration)
		{
			const x = elapsedTime / this._animationDuration;

			return MathUtils.clamp((1 - 2**(-10*x))*((1024 / 1023))*(this._end - this._start) + this._start, this._min, this._max);
		}
		else
		{
			this._end = MathUtils.clamp(this._end, this._min, this._max);
			return this._end;
		}
	}

	// elapsedTime since "setEnd" called in ms
	private getNextValue(elapsedTime: number)
	{
		return this._easing === Easing.EASE_IN_OUT ? this.smoothStep(elapsedTime) : this.exponentialOut(elapsedTime);
	}

	public increaseEndBy(value: number, clampBetweenMinAndMax: boolean = false)
	{
		this.setEnd(this._end + value, clampBetweenMinAndMax);
	}

	public decreaseEndBy(value: number, clampBetweenMinAndMax: boolean = false)
	{
		this.setEnd(this._end - value, clampBetweenMinAndMax);
	}

	public setEnd(value: number, clampBetweenMinAndMax: boolean = false, animationDuration: number = this._originalAnimationDuration)
	{
		this._animationDuration = animationDuration;
		const newEnd = clampBetweenMinAndMax ? MathUtils.clamp(value, this._min, this._max) : value;
		Convergence.addToActiveOnes(this);
		this._start = this._value;
		this._end = newEnd;
		this._timeStampAtSetEnd = SceneManager.timeStamp;

		if (!clampBetweenMinAndMax)
		{
			clearTimeout(this._timeoutID);
			this._timeoutID = setTimeout(() =>
			{
				this._end = MathUtils.clamp(this._end, this._min, this._max);
			}, this._animationDuration) as any;
		}
	}

	public reset(start?: number, end?: number, animationDuration: number = this._originalAnimationDuration)
	{
		this._animationDuration = animationDuration;
		Convergence.addToActiveOnes(this);
		this._start = start != null ? start : this._originalStart;
		this._end = end != null ? end : this._originalEnd;
		this._timeStampAtSetEnd = SceneManager.timeStamp;
	}

	private update(timeStamp: number)
	{
		this._prevDeltaTime = timeStamp - this._prevTimeStamp;
		const elapsedTime = timeStamp - this._timeStampAtSetEnd;
		const prevValue = this._value;
		this._value = this.getNextValue(elapsedTime);
		this._prevDeltaValue = this._value - prevValue;
		this._prevTimeStamp = timeStamp;

		if (this._value === prevValue)
		{
			this._start = this._end;
			this._hasChanged = false;
			Convergence.removeFromActiveOnes(this);
		}
		else
		{
			this._hasChanged = true;
		}
	}

	public get animationDuration()
	{
		return this._animationDuration;
	}

	public get originalAnimationDuration()
	{
		return this._originalAnimationDuration;
	}

	public get start()
	{
		return this._start;
	}

	public get value()
	{
		return this._value;
	}

	public get end()
	{
		return this._end;
	}

	public get hasChangedSinceLastTick()
	{
		return this._hasChanged;
	}

	public get prevDeltaValue()
	{
		return this._prevDeltaValue;
	}

	public get prevDeltaTime()
	{
		return this._prevDeltaTime;
	}

	public get derivateAt0()
	{
		return this._easing === Easing.EASE_OUT ?
		       6.938247437862991 : // Equals: (5*Math.log(2) * 2**11) / 1023;
		       0; // Smoothstep's derivate is 0 at 0
	}
}