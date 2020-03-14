import {SceneManager} from "./SceneManager";
import {Texture, TextureLoader, InstancedMesh, InstancedBufferGeometry, PlaneBufferGeometry, InstancedBufferAttribute, RawShaderMaterial, BoxBufferGeometry, Object3D, DynamicDrawUsage} from "three";
import {Shaders} from "./Shaders";
import {Constants} from "utils/Constants";

export class SceneLoader
{
	private _sceneManager: SceneManager;
	private _textureAtlas: Texture;

	private _instancedGeometry: InstancedBufferGeometry = new InstancedBufferGeometry().copy(new BoxBufferGeometry());
	private _instancedMesh: InstancedMesh;

	private _atlasRowNum: number = 5;

	private _count: number = 500000;

	constructor(scene: SceneManager)
	{
		this._sceneManager = scene;

		this.loadScene();
	}

	private loadScene()
	{
		this._textureAtlas = new TextureLoader().load("assets/atlas.png", (texture: Texture) =>
		{
			this._textureAtlas.needsUpdate = true;
			const center = new Float32Array(this._count * 3);

			const spaceSize = Constants.SPACE_SIZE;

			for (let i = 0; i < this._count; ++i)
			{
				center[i*3] = Math.random()*spaceSize;
				center[i*3 + 1] = Math.random()*spaceSize;
				center[i*3 + 2] = 0;
			}

			this._instancedGeometry.setAttribute("center", new InstancedBufferAttribute(center, 3));


			const uvOffset = new Float32Array(this._count * 2);

			for (let i = 0; i < this._count; ++i)
			{
				uvOffset[i*2] = Math.floor(Math.random() * (5 - 1)) / this._atlasRowNum; // random int between 0 and 4
				uvOffset[i*2 + 1] = Math.floor(Math.random() * (5 - 1)) / this._atlasRowNum; // random int between 0 and 4
			}

			this._instancedGeometry.setAttribute("uvOffset", new InstancedBufferAttribute(uvOffset, 2));

			const material = new RawShaderMaterial({
				uniforms: {
					map: {
						type: "t",
						value: this._textureAtlas
					},
					atlasSize: {
						type: "f",
						value: this._atlasRowNum
					}
				},
				vertexShader: Shaders.vertexShader,
				fragmentShader: Shaders.fragmentShader,
				transparent: true
			});


			this._instancedMesh = new InstancedMesh(this._instancedGeometry, material, this._count);


			const dummy = new Object3D();

			//this._instancedMesh.instanceMatrix.setUsage(DynamicDrawUsage);

			dummy.rotation.set(Math.PI / 2, 0, 0);
			for (let i = 0; i < this._count; ++i)
			{
				dummy.position.set(Math.random()*Constants.SPACE_SIZE, Math.random()*Constants.SPACE_SIZE, Math.random()*0.1);
				dummy.updateMatrix();
				this._instancedMesh.setMatrixAt(i, dummy.matrix);
			}

			this._instancedMesh.instanceMatrix.needsUpdate = true;

			this._sceneManager.scene.add(this._instancedMesh);
		});
	};
}