import {Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight, HemisphereLight, OrthographicCamera} from "three";
import { SceneLoader } from "./SceneLoader";
import { VignetteBackground } from "./VignetteBackground";
import {CameraControls} from "./CameraControls";
import {PointerDetector} from "utils/PointerDetector";
import {Convergence} from "utils/Convergence";
import {Constants} from "utils/Constants";

export class SceneManager
{
	private _canvas: HTMLCanvasElement;
	private _scene: Scene;
	private _cameraControls: CameraControls;
	private _renderer: WebGLRenderer;
	private _sceneLoader: SceneLoader;
	private _domElement: HTMLDivElement = document.createElement("div");
	private _activeCamera : PerspectiveCamera | OrthographicCamera;

	private static _timeStamp: number = 1;

	constructor()
	{
		this._domElement.style.position = "absolute";
		this._domElement.style.top = "0";
		this._domElement.style.left = "0";
		this._domElement.style.width = "100%";
		this._domElement.style.height = "100%";
		this._canvas = <HTMLCanvasElement>document.getElementById("myCanvas");
		this._canvas.parentElement.appendChild(this._domElement);
		this._scene = new Scene();

		//this.initBackground();
		//this.initLights();
		this.initControls();
		this.initRenderer();
		this.initMeshes();
		this.onWindowResize();
		this.animate(0);
	}

	private initBackground()
	{
		// const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !((<any>window).MSStream);

		// this._scene.add(new VignetteBackground({
		// 	aspect: this._camera.aspect,
		// 	grainScale: IS_IOS ? 0 : 0.001, // mattdesl/three-vignette-background#1
		// 	colors: ["#ffffff", "#353535"]
		// }).mesh);
	}


	private initLights()
	{
		const light1  = new AmbientLight(0xFFFFFF, 0.1);

		const light2  = new DirectionalLight(0xFFFFFF, 0.1);
		light2.position.set(0.5, 0, 0.866); // ~60ยบ

		const light3 = new HemisphereLight(0xffffbb, 0x080820, 0.8);

		this._scene.add(light1, light2, light3);
	}

	private initControls()
	{
		this._cameraControls = new CameraControls(this, new PointerDetector({
			element: this.domElement,
			maxPointers: 2,
			disableContextMenu: true,
			ignoreMiddleButton: false,
			ignoreRightButton: false,
			autoEnable: true
		}));
		this._cameraControls.activate();
		this._activeCamera = this._cameraControls.activeCamera;

		this._cameraControls.setSize(this._canvas.width, this._canvas.height, Constants.SPACE_SIZE, Constants.SPACE_SIZE);
	}

	private initMeshes()
	{
		this._sceneLoader = new SceneLoader(this);
	}

	private initRenderer()
	{
		const context = this._canvas.getContext("webgl2") || this._canvas.getContext("experimental-webgl2");
		this._renderer = new WebGLRenderer({
			antialias: true,
			canvas: this._canvas,
			context: <WebGLRenderingContext>context
		});
		this._renderer.setPixelRatio(window.devicePixelRatio);
		this._renderer.setClearColor(0xECF8FF);

		//this._renderer.sortObjects = false;
		// this._renderer.autoClear = false;
		// this._renderer.autoClearColor = false;
		// this._renderer.autoClearDepth = false;
		//this._renderer.getContext().disable(this._renderer.getContext().DEPTH_TEST);

		this._canvas.addEventListener("webglcontextlost", this.onContextLost);

		window.addEventListener("resize", this.onWindowResize);
	}

	public changeCameraType(newCameraType: "perspective" | "orthographic")
	{
		const oldCamera = this._activeCamera;
		this._cameraControls.changeCameraType(newCameraType);
		this._activeCamera = this._cameraControls.activeCamera;

		const hasChanged = oldCamera !== this._activeCamera;

		if (hasChanged)
		{
			this._activeCamera.updateProjectionMatrix();
			this._cameraControls.signals.cameraPropsChange.dispatch();
		}
	}

	private onWindowResize = () =>
	{
		this._canvas.width = 0;
		this._canvas.height = 0;

		const width = window.innerWidth;
		const height = window.innerHeight;

		this._renderer.setSize(width, height);
		this._cameraControls.resize(width, height);
	};

	private onContextLost = (event: Event) =>
	{
		event.preventDefault();

		alert("Unfortunately WebGL has crashed. Please reload the page to continue!");
	};

	public get scene()
	{
		return this._scene;
	}

	private update = (time: number) =>
	{
		SceneManager._timeStamp = time;
		Convergence.updateActiveOnes(SceneManager._timeStamp);
		this._cameraControls.update(true);
		this._renderer.render(this._scene, this._activeCamera);
	};

	private animate = (time: number) =>
	{
		this.update(time);
		this._renderer.setAnimationLoop(this.update);
	};

	public static get timeStamp()
	{
		return SceneManager._timeStamp;
	}

	public get canvas()
	{
		return this._canvas;
	}

	public get domElement()
	{
		return this._domElement;
	}
}