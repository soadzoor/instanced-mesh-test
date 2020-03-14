import {KeyboardListener} from "utils/KeyboardListener";
import {Vector3, PerspectiveCamera, OrthographicCamera, MathUtils as THREEMath} from "three";
import {SceneManager} from "./SceneManager";
import {Easing} from "utils/Convergence";
import {BoundedConvergence} from "utils/BoundedConvergence";
import {PointerDetector, Pointer} from "utils/PointerDetector";
import {PinchZoomGesture, IPinchZoomGestureData} from "utils/PinchZoomGesture";
import {Constants} from "utils/Constants";
import {Signal} from "utils/signal/Signal";
import {THREEUtils} from "utils/THREEUtils";
import {MathUtils} from "utils/MathUtils";
import {HTMLUtils} from "utils/HTMLUtils";

export interface IVec2Convergence
{
	x: BoundedConvergence;
	y: BoundedConvergence;
};

interface IVec2
{
	x: number;
	y: number;
}

export class CameraControls
{
	private _domElement: HTMLElement;
	private _sceneManager: SceneManager;
	private _cameraTarget: IVec2Convergence;
	private _cameraTargetV3: Vector3 = new Vector3();
	private _pCamera: PerspectiveCamera;
	private _oCamera: OrthographicCamera;
	private _activeCamera: PerspectiveCamera | OrthographicCamera;
	private _targetToCamera: Vector3 = new Vector3();

	private _pointerDetector: PointerDetector;
	private _pointerStart: {
		world: IVec2;
		local: IVec2;
	};
	private _zoomSpeed = 1.1;
	private _cameraDistance: BoundedConvergence = new BoundedConvergence(1, 1, 0, 1, Easing.EASE_OUT);
	private _pinchZoomGesture: PinchZoomGesture;
	private _animatedZoom = true;
	private _pinchZoomData: {
		cameraZoomOnPinchStart: number;
		previousMiddleOfPointers: IVec2;
	} = {
		cameraZoomOnPinchStart: null,
		previousMiddleOfPointers: null
	};

	private _spaceWidth: number;
	private _spaceHeight: number;

	private _isActive: boolean = false;

	private _azimuthAngle: BoundedConvergence = new BoundedConvergence(0, 0, -Infinity, Infinity, Easing.EASE_OUT, Constants.DURATIONS.CAMERA_MOVEMENT);
	private _polarAngle: BoundedConvergence = new BoundedConvergence(Constants.EPSILON, Constants.EPSILON, Constants.EPSILON, THREEMath.degToRad(80), Easing.EASE_OUT, Constants.DURATIONS.CAMERA_MOVEMENT);
	private _toX: Vector3 = new Vector3(1, 0, 0);
	private _toZ: Vector3 = new Vector3(0, 0, 1);

	private _cameraDataOnPointerDown: {
		target: IVec2;
		cameraObject: PerspectiveCamera | OrthographicCamera;
		distanceFromTarget: number;
	};

	private _polarAngleOnPointerDown: number;
	private _azimuthAngleOnPointerDown: number;

	private _previousCursorStyle: string;

	// Below ones are needed for damping
	private _dampOnPointerUp: boolean = false;
	private _timeoutID: number = null;
	// For some reason convergence.prevDeltaValue becomes 0 before the touchup event is called, so we save the proper prev values to these objects below
	private _prevTiltSpeed: IVec2 = {x: 0, y: 0};
	private _prevMoveSpeed: IVec2 = {x: 0, y: 0};

	public signals = {
		cameraPropsChange: Signal.create(),
		cameraZoomChange: Signal.create()
	};

	constructor(sceneManager: SceneManager, pointerDetector: PointerDetector)
	{
		this._domElement = sceneManager.domElement;
		this._sceneManager = sceneManager;
		this._pointerDetector = pointerDetector;

		const canvas = this._sceneManager.canvas;

		this._oCamera = new OrthographicCamera(-canvas.width / 2, canvas.width / 2, canvas.height / 2, -canvas.height / 2, 0.1, 20);
		this._oCamera.up = this._toZ.clone();
		this._pCamera = new PerspectiveCamera(Constants.FOV, 1, 1, 200);
		this._pCamera.up = this._toZ.clone();
		this._pCamera.position.setZ(5);
		this._activeCamera = this._oCamera;
		this._cameraTarget = {
			x: new BoundedConvergence(this._activeCamera.position.x, this._activeCamera.position.x, -Infinity, Infinity, Easing.EASE_OUT, Constants.DURATIONS.CAMERA_MOVEMENT),
			y: new BoundedConvergence(this._activeCamera.position.y, this._activeCamera.position.y, -Infinity, Infinity, Easing.EASE_OUT, Constants.DURATIONS.CAMERA_MOVEMENT)
		};

		KeyboardListener.getInstance().setEnabled(true);

		this._pinchZoomGesture = new PinchZoomGesture(this._pointerDetector);
	}

	public activate()
	{
		if (!this._isActive)
		{
			this._pointerDetector.signals.down.add(this.onPointerDown);
			this._pointerDetector.signals.move.add(this.onPointerMove);
			this._pointerDetector.signals.up.add(this.onPointerUp);
			this._domElement.addEventListener("wheel", this.onMouseWheel, {passive: false});
			this._pinchZoomGesture.signals.start.add(this.onStartPinchZoom);
			this._pinchZoomGesture.signals.update.add(this.onUpdatePinchZoom);
			this._pinchZoomGesture.signals.end.add(this.onEndPinchZoom);
			this._pinchZoomGesture.listen();
			this._isActive = true;
		}
	}

	public deactivate()
	{
		if (this._isActive)
		{
			this._pointerDetector.signals.down.remove(this.onPointerDown);
			this._pointerDetector.signals.move.remove(this.onPointerMove);
			this._pointerDetector.signals.up.remove(this.onPointerUp);
			this._domElement.removeEventListener("wheel", this.onMouseWheel);
			this._pinchZoomGesture.signals.start.remove(this.onStartPinchZoom);
			this._pinchZoomGesture.signals.update.remove(this.onUpdatePinchZoom);
			this._pinchZoomGesture.signals.end.remove(this.onEndPinchZoom);
			// this._pinchZoomGesture.endlisten()?;
			this._isActive = false;
		}
	}

	private onPointerDown = (pointer: Pointer) =>
	{
		this.pointerDown(pointer);
	};

	public pointerDown(pointer: Pointer)
	{
		this._previousCursorStyle = this._domElement.style.cursor;
		this._domElement.style.cursor = "grabbing";
		const worldPos = THREEUtils.domCoordinatesToWorldCoordinates(pointer.localX, pointer.localY, this._domElement, this._activeCamera);
		this._pointerStart = {
			world: worldPos,
			local: {
				x: pointer.localX,
				y: pointer.localY
			}
		};
		this._cameraDataOnPointerDown = {
			target: {
				x: this._cameraTarget.x.value,
				y: this._cameraTarget.y.value
			},
			distanceFromTarget: this._cameraDistance.value,
			cameraObject: this._activeCamera.clone()				
		};

		this._polarAngleOnPointerDown = this._polarAngle.value;
		this._azimuthAngleOnPointerDown = this._azimuthAngle.value;

		if (pointer.isMiddleClick)
		{
			//this._lastMouseEventTimeStamp = performance.now();
		}
		else if (pointer.isRightClick)
		{
			console.log(this._pointerStart);
		}
	}

	private onPointerMove = (pointer: Pointer) =>
	{
		//const currentTimeStamp = performance.now();
		this.pointerMove(pointer, 0);
	};

	public pointerMove(pointer: Pointer, currentTimeStamp: number, force: boolean = false)
	{
		if (!this._pointerStart?.world)
		{
			return;
		}

		if (KeyboardListener.isShiftDown)
		{
			const deltaX = pointer.localX - pointer.startX;
			const deltaY = pointer.localY - pointer.startY;
			this.rotateCamera(deltaX, deltaY);

			this._dampOnPointerUp = true;
			clearTimeout(this._timeoutID);
			this._timeoutID = setTimeout(this.cancelDamping, 100) as any as number;
		}
		else
		{
			if (this._cameraDistance.value !== this._cameraDataOnPointerDown.distanceFromTarget)
			{
				const camera = this._cameraDataOnPointerDown.cameraObject;
				this.updateCameraPos(camera, this._cameraDataOnPointerDown.target.x, this._cameraDataOnPointerDown.target.y);

				if (camera instanceof OrthographicCamera)
				{
					camera.zoom = this.cameraZoomValue;
					camera.updateProjectionMatrix();
				}
				THREEUtils.updateMatrices(camera);
			}
			const worldPos = THREEUtils.domCoordinatesToWorldCoordinates(pointer.localX, pointer.localY, this._domElement, this._cameraDataOnPointerDown.cameraObject);
			if (worldPos)
			{
				this.pan(this._pointerStart.world.x - worldPos.x, this._pointerStart.world.y - worldPos.y);

				this._dampOnPointerUp = true;
				clearTimeout(this._timeoutID);
				this._timeoutID = setTimeout(this.cancelDamping, 100) as any as number;
			}
		}
		
		//this._lastMouseEventTimeStamp = currentTimeStamp;
	}

	/**
	 * Delta is difference between pointernow and pointerstart, NOT the previous pointerpos
	 * @param deltaX 
	 * @param deltaY 
	 */
	public pan(deltaX: number, deltaY: number)
	{
		this.moveCameraTo(this._cameraDataOnPointerDown.target.x + deltaX, this._cameraDataOnPointerDown.target.y + deltaY);
	};

	public rotateCamera(deltaX: number, deltaY: number)
	{
		const coeff = 100;
		this._azimuthAngle.reset(this._azimuthAngleOnPointerDown - deltaX / coeff, this._azimuthAngleOnPointerDown - deltaX / coeff);
		this._polarAngle.reset(this._polarAngleOnPointerDown - deltaY / coeff, this._polarAngleOnPointerDown - deltaY / coeff);
	}

	private onPointerUp = (pointer: Pointer) =>
	{
		if (!this._pointerStart)
		{
			return;
		}

		if (this._dampOnPointerUp)
		{
			this._dampOnPointerUp = false;

			const convergenceX = KeyboardListener.isShiftDown ? this._azimuthAngle : this._cameraTarget.x;
			const convergenceY = KeyboardListener.isShiftDown ? this._polarAngle   : this._cameraTarget.y;
			const speed = KeyboardListener.isShiftDown ? this._prevTiltSpeed : this._prevMoveSpeed
			const speedAbs = THREEUtils.getLength(speed);
			if (MathUtils.isValidNumber(speedAbs) && speedAbs > 0)
			{
				const multiplicator = convergenceX.derivateAt0;

				// s = v * t => delta
				const time = Constants.DURATIONS.CAMERA_MOVEMENT;
				const delta = {
					x: time * speed.x / multiplicator,
					y: time * speed.y / multiplicator
				};

				convergenceX.setEnd(convergenceX.value + delta.x);
				convergenceY.setEnd(convergenceY.value + delta.y);
			}
		}

		this._domElement.style.cursor = this._previousCursorStyle;
		this._pointerStart = null;
	};

	private cancelDamping = () =>
	{
		this._dampOnPointerUp = false;
	};

	private onStartPinchZoom = (zoomData: IPinchZoomGestureData) =>
	{
		this._pinchZoomData.cameraZoomOnPinchStart = this.cameraZoomValue;
		this._pinchZoomData.previousMiddleOfPointers = {
			x: (zoomData.pointer1.localX + zoomData.pointer2.localX) / 2,
			y: (zoomData.pointer1.localY + zoomData.pointer2.localY) / 2
		};
	};

	private onUpdatePinchZoom = (zoomData: IPinchZoomGestureData) =>
	{
		const pointer1 = zoomData.pointer1;
		const pointer2 = zoomData.pointer2;

		const newZoomLevel = this._pinchZoomData.cameraZoomOnPinchStart * (zoomData.distance / zoomData.startDistance);

		const middlePointOfPointers = {
			x: (pointer1.localX + pointer2.localX) / 2,
			y: (pointer1.localY + pointer2.localY) / 2
		};

		const middlePointDelta = {
			x: -(middlePointOfPointers.x - this._pinchZoomData.previousMiddleOfPointers.x) / newZoomLevel,
			y:  (middlePointOfPointers.y - this._pinchZoomData.previousMiddleOfPointers.y) / newZoomLevel
		};

		//this.translateCamera(middlePointDelta.x, middlePointDelta.y, true);

		const cursorWorldPos = THREEUtils.domCoordinatesToWorldCoordinates(middlePointOfPointers.x, middlePointOfPointers.y, this._domElement, this._activeCamera);

		if (cursorWorldPos)
		{
			this.zoom(newZoomLevel, cursorWorldPos, true);

			this._pinchZoomData.previousMiddleOfPointers = {
				x: (pointer1.localX + pointer2.localX) / 2,
				y: (pointer1.localY + pointer2.localY) / 2
			};
		}
	};

	private onEndPinchZoom = (zoomData: IPinchZoomGestureData) =>
	{
		
	};

	public setSize(canvasWidth: number, canvasHeight: number, spaceWidth: number, spaceHeight: number)
	{
		this._spaceWidth = spaceWidth;
		this._spaceHeight = spaceHeight;

		this.resize(canvasWidth, canvasHeight, true);

		this._azimuthAngle.reset();
		this._polarAngle.reset();

		this._cameraTarget.x.reset(null, null, 0, spaceWidth);
		this._cameraTarget.y.reset(null, null, 0, spaceHeight);

		this.moveCameraTo(spaceWidth / 2, spaceHeight / 2);
	}

	public resize(canvasWidth: number, canvasHeight: number, isInitial: boolean = false)
	{
		// Without these clamps, we can easily have NaN values
		canvasWidth = MathUtils.clamp(canvasWidth, 1, 10000);
		canvasHeight = MathUtils.clamp(canvasHeight, 1, 10000);

		const canvasAspectRatio = canvasWidth / canvasHeight;
		const spaceRatio = this._spaceWidth / this._spaceHeight;
		this._pCamera.aspect = canvasAspectRatio;
		this._pCamera.updateProjectionMatrix();

		if (this._spaceWidth != null && this._spaceHeight != null)
		{
			const vFOV = THREEMath.degToRad(Constants.FOV);
			const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * this._pCamera.aspect);

			const getDistance = (sideWidth: number, sideHeight: number) =>
			{
				return (spaceRatio < canvasAspectRatio ? sideHeight / 2 / Math.tan(vFOV / 2) : sideWidth / 2 / Math.tan(hFOV / 2));
			}
			const maxDistance = getDistance(this._spaceWidth, this._spaceHeight);

			const minDistance = 5;

			this._activeCamera.near = minDistance * Math.cos(vFOV) / 10;
			const diagonal = Math.sqrt(this._spaceWidth**2 + this._spaceHeight**2);
			this._activeCamera.far = Math.sqrt(maxDistance**2 + diagonal**2) * 1.2;
			this._activeCamera.updateProjectionMatrix();

			if (isInitial)
			{
				//this._cameraDistance.reset(maxDistance, maxDistance, minDistance, maxDistance);
			}
			else
			{
				this._cameraDistance.reset(this._cameraDistance.start, this._cameraDistance.end, minDistance, maxDistance);
			}
		}

		const canvasToSpaceRatio = spaceRatio < canvasAspectRatio ? canvasHeight / this._spaceHeight : canvasWidth / this._spaceWidth;

		const frustumSize = {
			width: canvasWidth * this.cameraZoomMin / canvasToSpaceRatio,
			height: canvasHeight * this.cameraZoomMin / canvasToSpaceRatio
		};
		this._oCamera.left = -frustumSize.width / 2;
		this._oCamera.right = frustumSize.width / 2;
		this._oCamera.top = frustumSize.height / 2;
		this._oCamera.bottom = -frustumSize.height / 2;
		this._oCamera.updateProjectionMatrix();
	}

	public moveCameraTo(x: number, y: number, animated: boolean = false, animationDuration: number = this._cameraTarget.x.originalAnimationDuration)
	{
		if (animated)
		{
			this._cameraTarget.x.reset(this._cameraTarget.x.end, x, undefined, undefined, true, animationDuration);
			this._cameraTarget.y.reset(this._cameraTarget.y.end, y, undefined, undefined, true, animationDuration);
		}
		else
		{
			this._cameraTarget.x.reset(x, x);
			this._cameraTarget.y.reset(y, y);
		}
	}

	public onMouseWheel = (event: MouseWheelEvent) =>
	{
		event.preventDefault();
		const cursorOffset = HTMLUtils.clientXYToOffsetXY(this._domElement, event.clientX, event.clientY);
		const cursorWorldPos = THREEUtils.domCoordinatesToWorldCoordinates(cursorOffset.x, cursorOffset.y, this._domElement, this._activeCamera);

		if (cursorWorldPos)
		{
			const direction = -Math.sign(event.deltaY);
			this.zoomToDirection(direction, cursorWorldPos);
		}
	};

	public zoomToDirection(direction: number, pivot?: {x: number, y: number})
	{
		/** direction should be either -1 or 1 */
		const currentZoomValue = this._cameraDistance.min / this._cameraDistance.end; // on animation end
		this.zoom(direction > 0 ? (currentZoomValue * this._zoomSpeed) : (currentZoomValue / this._zoomSpeed), pivot);
	}

	public zoom(amount: number, pivot?: {x: number, y: number}, animatedZoom: boolean = this._animatedZoom, animationDuration: number = this._cameraDistance.originalAnimationDuration)
	{
		const previousCameraDistance = this._cameraDistance.value;
		const newCameraDistance = this._cameraDistance.min / amount;

		if (animatedZoom)
		{
			this._cameraDistance.setEnd(newCameraDistance, true, animationDuration);
		}
		else
		{
			this._cameraDistance.reset(newCameraDistance, newCameraDistance, undefined, undefined, true);
		}

		if (pivot)
		{
			const clampedNewCameraDistance = MathUtils.clamp(newCameraDistance, this._cameraDistance.min, this._cameraDistance.max);

			const targetToPivot = {
				x: pivot.x - this._cameraTarget.x.value,
				y: pivot.y - this._cameraTarget.y.value
			};
			
			const coeff = (previousCameraDistance - clampedNewCameraDistance) / previousCameraDistance;

			const newTarget = {
				x: this._cameraTarget.x.value + targetToPivot.x * coeff,
				y: this._cameraTarget.y.value + targetToPivot.y * coeff
			};

			if (animatedZoom)
			{
				this._cameraTarget.x.setEnd(newTarget.x, true, animationDuration);
				this._cameraTarget.y.setEnd(newTarget.y, true, animationDuration);
			}
			else
			{
				this._cameraTarget.x.reset(newTarget.x, newTarget.x, undefined, undefined, true);
				this._cameraTarget.y.reset(newTarget.y, newTarget.y, undefined, undefined, true);
			}
		}
	}

	public fitToScreen(animated: boolean = this._animatedZoom)
	{
		const newAzimuthAngle = Math.round(this._azimuthAngle.value / (2*Math.PI)) * 2*Math.PI;
		if (animated)
		{
			this._cameraTarget.x.setEnd(this._spaceWidth / 2, true);
			this._cameraTarget.y.setEnd(this._spaceHeight / 2, true);
			this._cameraDistance.setEnd(this._cameraDistance.max, true, Constants.DURATIONS.CAMERA_MOVEMENT);
			this._azimuthAngle.setEnd(newAzimuthAngle, true);
			this._polarAngle.setEnd(Constants.EPSILON, true);
		}
		else
		{
			this._cameraTarget.x.reset(this._spaceWidth / 2, this._spaceWidth / 2);
			this._cameraTarget.y.reset(this._spaceHeight / 2, this._spaceHeight / 2);
			this._cameraDistance.reset(this._cameraDistance.max, this._cameraDistance.max);
			this._azimuthAngle.reset(newAzimuthAngle, newAzimuthAngle);
			this._polarAngle.reset(Constants.EPSILON, Constants.EPSILON);
		}
	}

	// Should be called only by SpaceViewRenderer's changeCameraType
	public changeCameraType(newCameraType: "perspective" | "orthographic")
	{
		const oldCamera = this._activeCamera;

		if (newCameraType === "perspective")
		{
			this._activeCamera = this._pCamera;
		}
		else
		{
			this._oCamera.zoom = this.cameraZoomValue;
			this._activeCamera = this._oCamera;
		}

		const hasChanged = oldCamera !== this._activeCamera;

		if (hasChanged)
		{
			this._activeCamera.far = oldCamera.far;
			this._activeCamera.near = oldCamera.near;
			this._activeCamera.updateProjectionMatrix();
			this.update(true);
		}
	}

	private updateCameraPos(camera: PerspectiveCamera | OrthographicCamera = this._activeCamera, targetX: number = this._cameraTarget.x.value, targetY: number = this._cameraTarget.y.value)
	{
		this._targetToCamera.copy(this._toZ)
							.applyAxisAngle(this._toX, this._polarAngle.value)
							.applyAxisAngle(this._toZ, this._azimuthAngle.value)
							.normalize()
							.multiplyScalar(this._cameraDistance.value);
		this._cameraTargetV3.set(targetX, targetY, 0);
		camera.position.copy(this._cameraTargetV3).add(this._targetToCamera);
	}

	public update(force: boolean = false)
	{
		const hasZoomChanged = this._cameraDistance.hasChangedSinceLastTick;

		if (this._cameraTarget.x.hasChangedSinceLastTick ||
			this._cameraTarget.y.hasChangedSinceLastTick ||
			this._azimuthAngle.hasChangedSinceLastTick ||
			this._polarAngle.hasChangedSinceLastTick ||
			hasZoomChanged ||
			force)
		{
			this._prevTiltSpeed.x = this._azimuthAngle.prevDeltaValue / this._azimuthAngle.prevDeltaTime;
			this._prevTiltSpeed.y = this._polarAngle.prevDeltaValue / this._azimuthAngle.prevDeltaTime;
			this._prevMoveSpeed.x = this._cameraTarget.x.prevDeltaValue / this._cameraTarget.x.prevDeltaTime;
			this._prevMoveSpeed.y = this._cameraTarget.y.prevDeltaValue / this._cameraTarget.y.prevDeltaTime;
			if (this._polarAngle.hasChangedSinceLastTick)
			{
				const newCameraType = Math.abs(this._polarAngle.value - this._polarAngle.min) < Constants.EPSILON ? "orthographic" : "perspective";
				this._sceneManager.changeCameraType(newCameraType);
			}

			this.updateCameraPos();
			THREEUtils.updateMatrices(this._activeCamera);
			this._activeCamera.lookAt(this._cameraTarget.x.value, this._cameraTarget.y.value, 0);


			if (hasZoomChanged)
			{
				if (this._activeCamera instanceof OrthographicCamera)
				{
					this._activeCamera.zoom = this.cameraZoomValue;
					this._activeCamera.updateProjectionMatrix();
				}
				this.signals.cameraZoomChange.dispatch();
			}
			this.signals.cameraPropsChange.dispatch();
		}
	}

	public get cameraDistance()
	{
		return this._cameraDistance;
	}

	// in worldpos
	public get target()
	{
		return {
			x: this._cameraTarget.x.value,
			y: this._cameraTarget.y.value
		};
	}

	public get activeCamera()
	{
		return this._activeCamera;
	}

	public get cameraZoomValue()
	{
		return this._cameraDistance.min / this._cameraDistance.value;
	}

	public get cameraZoomMax()
	{
		return 1;
	}

	public get cameraZoomMin()
	{
		return this._cameraDistance.min / this._cameraDistance.max;
	}
}