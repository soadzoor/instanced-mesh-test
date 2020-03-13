import {Texture, ClampToEdgeWrapping, LinearFilter, Object3D, Mesh, Vector3, Scene, TextureFilter, OrthographicCamera, Vector2, Raycaster, PerspectiveCamera, BufferGeometry, BufferAttribute, Material, MeshBasicMaterial} from "three";

type ICornerLetter = "a" | "b";

interface IElement
{
	offsetWidth: number;
	offsetHeight: number;
}

interface ILineSegment
{
	A: IVec2;
	B: IVec2;
}

export interface IVec2
{
	x: number;
	y: number;
	setX?: (x: number) => void;
	setY?: (y: number) => void;
}

export interface ISize
{
	width: number;
	height: number;
}

export interface IRect
{
	position: IVec2;
	scale: IVec2;
}

export class THREEUtils
{
	private static readonly _raycaster = new Raycaster();
	private static readonly _plane = {
		q: new Vector3(0, 0, 0), // a point on the surface of the plane
		n: new Vector3(0, 0, 1) // the normal vector of the plane
	};
	/**
	 * With these options, it's not required for the image to be power of 2 in dimensions (webgl 1 limitation)
	 */
	public static applySimpleFilterToTexture(texture: Texture, filter: TextureFilter = LinearFilter)
	{
		texture.generateMipmaps = false;
		texture.anisotropy = 0;
		texture.wrapS = texture.wrapT = ClampToEdgeWrapping;

		texture.minFilter = filter;
		texture.magFilter = filter;

		texture.needsUpdate = true;
	};

	public static clearContainer(container: Object3D)
	{
		for (let i = container.children.length - 1; i >= 0; --i)
		{
			if (container.children[i].children.length > 0)
			{
				THREEUtils.clearContainer(container.children[i]);
			}
			container.remove(container.children[i]);
		}
	}

	public static disposeContainer(container: Object3D)
	{
		container.traverse((node: Object3D) =>
		{
			if (node instanceof Mesh)
			{
				const material = node.material as MeshBasicMaterial;
				if (material.map)
				{
					material.map.dispose();
				}
				material.dispose();
			}
		});
	}

	public static disposeAndClearContainer(container: Object3D)
	{
		THREEUtils.disposeContainer(container);
		THREEUtils.clearContainer(container);
	}

	public static detectCollision(rect1: IRect, rect2: IRect)
	{
		// https://gamedev.stackexchange.com/questions/586/what-is-the-fastest-way-to-work-out-2d-bounding-box-intersection
		return (Math.abs(rect1.position.x - rect2.position.x) * 2 < (rect1.scale.x + rect2.scale.x)) &&
		       (Math.abs(rect1.position.y - rect2.position.y) * 2 < (rect1.scale.y + rect2.scale.y));
    }

	public static createScene(sceneName: string, initialPosition: Vector3 = new Vector3(0, 0, 0), initialScale: Vector3 = new Vector3(1, 1, 1), autoUpdate: boolean = false)
	{
		const scene = new Scene();
		scene.name = sceneName;
		scene.position.copy(initialPosition);
		scene.scale.copy(initialScale);
		scene.autoUpdate = autoUpdate;
		scene.matrixAutoUpdate = autoUpdate;
		THREEUtils.updateMatrices(scene);

		return scene;
	}

	/**
	 * Adds element to a container sets autoUpdate to false and updates matrices after that immediately
	 * This method for rendering is much faster, but we'll have to manually update the matrices when needed
	 * @param container 
	 * @param element 
	 */
	public static add(container: Object3D, element: Object3D)
	{
		container.add(element);
		element.matrixAutoUpdate = false;
		THREEUtils.updateMatrices(element);
	}

	public static renderToTop(element: Object3D)
	{
		// With this trick we can render it on top of the others (the objects are being rendered in order, zbuffer is disabled!)
		const parent = element.parent;
		parent.remove(element);
		parent.add(element);
	}

	public static setPosition(element: Object3D, x: number, y: number, z: number)
	{
		element.position.set(x, y, z);
		THREEUtils.updateMatrices(element);
	}

	public static setScale(element: Object3D, x: number, y: number, z: number = 1)
	{
		element.scale.set(x, y, z);
		THREEUtils.updateMatrices(element);
	}

	public static updateMatrices(element: Object3D)
	{
		element.updateMatrix();
		element.updateMatrixWorld();
	}

	/**
	 * return values are between -1 and 1
	 */
	public static domCoordinatesToNDC(x: number, y: number, domElement: HTMLElement)
	{
		return {
			x: (x / domElement.offsetWidth - 0.5) * 2,
			y:-(y / domElement.offsetHeight - 0.5) * 2 /** y values are flipped when we compare html coordinates with 3d coordinates */
		};
	}

	public static domCoordinatesToWorldCoordinates(x: number, y: number, domElement: HTMLElement, camera: OrthographicCamera | PerspectiveCamera)
	{
		const NDC = THREEUtils.domCoordinatesToNDC(x, y, domElement);

		return THREEUtils.NDCtoWorldCoordinates(NDC.x, NDC.y, camera);
	}

	public static NDCtoWorldCoordinates(x: number, y: number, spaceSize: ISize): IVec2;
	public static NDCtoWorldCoordinates(x: number, y: number, camera: OrthographicCamera | PerspectiveCamera): IVec2;
	public static NDCtoWorldCoordinates(x: number, y: number, cameraOrSpaceSize: (OrthographicCamera | PerspectiveCamera) | ISize)
	{
		if (cameraOrSpaceSize instanceof OrthographicCamera || cameraOrSpaceSize instanceof PerspectiveCamera)
		{
			const camera = cameraOrSpaceSize;
			/**
			 * See the intersectPlane function here: http://vargapeter.info/thesis.pdf
			 * */
			THREEUtils._raycaster.setFromCamera({x: x, y: y}, camera);
			const ray = THREEUtils._raycaster.ray;

			const plane = THREEUtils._plane;
			const t = plane.n.dot(plane.q.clone().sub(ray.origin)) / plane.n.dot(ray.direction);

			if (t < 0)
			{
				return null;
			}

			const hitPoint = ray.origin.add(ray.direction.multiplyScalar(t));

			return {
				x: hitPoint.x,
				y: hitPoint.y
			};
		}
		else
		{
			const spaceSize = cameraOrSpaceSize;

			return {
				x: x * spaceSize.width,
				y: y * spaceSize.height
			};
		}
	}

	public static worldCoordinatesToDomCoordinates(worldX: number, worldY: number, domElement: IElement, camera: OrthographicCamera | PerspectiveCamera): IVec2;
	public static worldCoordinatesToDomCoordinates(worldX: number, worldY: number, domElement: IElement, spaceSize: ISize): IVec2;
	public static worldCoordinatesToDomCoordinates(worldX: number, worldY: number, domElement: IElement, cameraOrSpaceSize: OrthographicCamera | PerspectiveCamera | ISize)
	{
		// Yes, they are the same below.. TypeScript bug..?
		const ndc = cameraOrSpaceSize instanceof OrthographicCamera || cameraOrSpaceSize instanceof PerspectiveCamera ? THREEUtils.worldCoordinatesToNDC(worldX, worldY, cameraOrSpaceSize) : THREEUtils.worldCoordinatesToNDC(worldX, worldY, cameraOrSpaceSize);

		return {
			x: ndc.x * domElement.offsetWidth,
			y: domElement.offsetHeight - ndc.y * domElement.offsetHeight
		};
	}

	public static worldCoordinatesToNDC(worldX: number, worldY: number, camera: OrthographicCamera | PerspectiveCamera): IVec2;
	public static worldCoordinatesToNDC(worldX: number, worldY: number, spaceSize: ISize): IVec2;
	public static worldCoordinatesToNDC(worldX: number, worldY: number, cameraOrSpaceSize: OrthographicCamera | PerspectiveCamera | ISize)
	{
		if (cameraOrSpaceSize instanceof OrthographicCamera || cameraOrSpaceSize instanceof PerspectiveCamera)
		{
			const camera = cameraOrSpaceSize;
			camera.updateMatrixWorld();

			const position = new Vector3(worldX, worldY, 0);
			position.project(camera);

			return {
				x: (position.x + 1) / 2,
				y: (position.y + 1) / 2
			};
		}
		else // we simply assume a top-down view and we interpolate the coords between space
		{
			const spaceSize = cameraOrSpaceSize;

			return {
				x: (worldX / spaceSize.width),
				y: (worldY / spaceSize.height)
			};
		}
	}

	public static getLength(vec: IVec2)
	{
		return Math.sqrt(vec.x * vec.x + vec.y * vec.y);
	}

	public static normalize(vec: IVec2)
	{
		const len = THREEUtils.getLength(vec);

		return {
			x: vec.x / len,
			y: vec.y / len
		};
	}

	/** Returns the normalized normal vector of vec */
	public static getNormal(vec: IVec2)
	{
		return THREEUtils.normalize({
			x: vec.y,
			y: -vec.x
		});
	}

	public static multiplyByScalar(vec: IVec2, scalar: number)
	{
		return {
			x: vec.x * scalar,
			y: vec.y * scalar
		};
	}

	public static calculateDistance(pathCoords: IVec2[])
	{
		let sumOfParts = 0;

		for (let i = 0; i < pathCoords.length - 1; ++i)
		{
			const vertexA = pathCoords[i];
			const vertexB = pathCoords[i + 1];

			sumOfParts += Math.sqrt((vertexB.x - vertexA.x)**2 + (vertexB.y - vertexA.y)**2);
		}

		return sumOfParts;
	}

	public static calculateArea(pathCoords: IVec2[])
	{
		/**
		 * Based on this: https://www.mathopenref.com/coordpolygonarea.html
		 */

		// we need to combine the last vertex with the first one as well
		const xyPairs = [...pathCoords, pathCoords[0]];

		let sumOfParts = 0;

		for (let i = 0; i < xyPairs.length - 1; ++i)
		{
			const vertexA = xyPairs[i];
			const vertexB = xyPairs[i + 1];

			sumOfParts += vertexA.x*vertexB.y - vertexA.y*vertexB.x;
		}

		return Math.abs(sumOfParts / 2);
	}

	public static cloneGeometryData(vertices: IVec2[])
	{
		const geometryData: IVec2[] = [];

		for (const vertex of vertices)
		{
			geometryData.push({
				x: vertex.x,
				y: vertex.y
			});
		}

		return geometryData;
	}

	public static calculateBox(vertices: IVec2[])
	{
		const min = {
			x: vertices[0].x,
			y: vertices[0].y
		};

		const max = {
			x: vertices[0].x,
			y: vertices[0].y
		};

		for (let i = 1; i < vertices.length; ++i)
		{
			const vertex = vertices[i];
			if (vertex.x < min.x)
			{
				min.x = vertex.x;
			}
			if (vertex.y < min.y)
			{
				min.y = vertex.y;
			}
			if (vertex.x > max.x)
			{
				max.x = vertex.x;
			}
			if (vertex.y > max.y)
			{
				max.y = vertex.y;
			}
		}

		return {
			max: max,
			min: min
		};
	}

	/**
	 * 
	 * @param side, can be calculated as follows: side = {x: max.x - min.x,	y: max.y - min.y};
	 * @param a pointer-start
	 * @param b pointer-current
	 */
	public static constrainScale(side: IVec2, a: IVec2, b: IVec2, fixedPoint: ICornerLetter = "a")
	{
		const newA = {
			x: a.x,
			y: a.y
		};

		const newB = {
			x: b.x,
			y: b.y
		};

		const sideSize = Math.max(side.x, side.y);
		if (fixedPoint === "a")
		{
			newB.x = a.x < b.x ? a.x + sideSize : a.x - sideSize;
			newB.y = a.y < b.y ? a.y + sideSize : a.y - sideSize;
		}
		else
		{
			newA.x = b.x < a.x ? b.x + sideSize : b.x - sideSize;
			newA.y = b.y < a.y ? b.y + sideSize : b.y - sideSize;
		}

		return {
			a: newA,
			b: newB
		};
	}

	public static snapTo45Deg(side: IVec2, a: IVec2, b: IVec2, fixedPoint: ICornerLetter = "a")
	{
		let newA = {
			x: a.x,
			y: a.y
		};

		let newB = {
			x: b.x,
			y: b.y
		};

		if (side.x < side.y / 2)
		{
			if (fixedPoint === "a")
			{
				newB.x = a.x;
			}
			else
			{
				newA.x = b.x;
			}
		}
		else if (side.y < side.x / 2)
		{
			if (fixedPoint === "a")
			{
				newB.y = a.y;
			}
			else
			{
				newA.y = b.y;
			}
		}
		else
		{
			const constrainCoords = THREEUtils.constrainScale(side, a, b, fixedPoint);
			newA = constrainCoords.a;
			newB = constrainCoords.b;
		}

		return {
			a: newA,
			b: newB
		};
	}

	public static applyOffsetToGeometryData(geometryData: IVec2[], offset: IVec2)
	{
		for (const vertex of geometryData)
		{
			vertex.x += offset.x;
			vertex.y += offset.y;
		}
	}

	public static applyRotationToBufferGeometry(bufferGeometry: BufferGeometry, angle: number)
	{
		const tempVertex = new Vector2();
		const pivotVector = new Vector2(0, 0);

		const positionAttribute = bufferGeometry.attributes.position as BufferAttribute;

		for (let i = 0; i < positionAttribute.count; ++i)
		{
			tempVertex.set(positionAttribute.getX(i), positionAttribute.getY(i));
			tempVertex.rotateAround(pivotVector, angle);

			positionAttribute.setXY(i, tempVertex.x, tempVertex.y);
		}

		positionAttribute.needsUpdate = true;
	}

	public static applyOffsetToBufferGeometry(bufferGeometry: BufferGeometry, offset: IVec2)
	{
		const positionAttribute = bufferGeometry.attributes.position as BufferAttribute;

		for (let i = 0; i < positionAttribute.count; ++i)
		{
			const newX = positionAttribute.getX(i) + offset.x;
			const newY = positionAttribute.getY(i) + offset.y;

			positionAttribute.setXY(i, newX, newY);
		}

		positionAttribute.needsUpdate = true;
	}

	/**
	 * @param vertices 
	 * @param pivot 
	 * @param angle 
	 */
	public static getRotatedVertices(vertices: IVec2[], angle: number, pivot?: IVec2)
	{
		const pivotVector = new Vector2();
		if (pivot)
		{
			pivotVector.set(pivot.x, pivot.y);
		}
		else
		{
			const {max, min} = THREEUtils.calculateBox(vertices);
			pivotVector.set((max.x + min.x) / 2, (max.y + min.y) / 2);
		}

		const tempVertex = new Vector2();

		return vertices.map((vertex: IVec2) =>
		{
			tempVertex.set(vertex.x, vertex.y);
			tempVertex.rotateAround(pivotVector, angle);

			return {
				x: tempVertex.x,
				y: tempVertex.y
			};
		});
	}

	public static getGeometryDataFromBox(min: IVec2, max: IVec2)
	{
		return [
			{
				x: min.x,
				y: min.y
			},
			{
				x: max.x,
				y: min.y
			},
			{
				x: max.x,
				y: max.y
			},
			{
				x: min.x,
				y: max.y
			}
		];
	}

	// https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
	public static isPointInsidePolygon(point: IVec2, polygon: IVec2[])
	{
		const x = point.x;
		const y = point.y;

		let inside = false;

		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++)
		{
			const xi = polygon[i].x;
			const yi = polygon[i].y;
			const xj = polygon[j].x;
			const yj = polygon[j].y;

			const intersect = ((yi > y) !== (yj > y)) &&
			                  (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
			if (intersect)
			{
				inside = !inside;
			}
		}

		return inside;
	}

	// https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
	public static doesLineSegmentIntersectLineSegment(l1: ILineSegment, l2: ILineSegment)
	{
		// a: l1.A.x
		// b: l1.A.y
		// c: l1.B.x
		// d: l1.B.y

		// p: l2.A.x
		// q: l2.A.y
		// r: l2.B.x
		// s: l2.B.y

		const det = (l1.B.x - l1.A.x) * (l2.B.y - l2.A.y) - (l2.B.x - l2.A.x) * (l1.B.y - l1.A.y);

		if (det === 0)
		{
			return false;
		}
		else
		{
			const lambda = ((l2.B.y - l2.A.y) * (l2.B.x - l1.A.x) + (l2.A.x - l2.B.x) * (l2.B.y - l1.A.y)) / det;
			const gamma = ((l1.A.y - l1.B.y) * (l2.B.x - l1.A.x) + (l1.B.x - l1.A.x) * (l2.B.y - l1.A.y)) / det;

			return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
		}
	}

	public static isPolygonInsidePolygon(childPolygon: IVec2[], parentPolygon: IVec2[])
	{
		for (const vertex of childPolygon)
		{
			if (!THREEUtils.isPointInsidePolygon(vertex, parentPolygon))
			{
				return false;
			}
		}

		let lineA: ILineSegment;
		let lineB: ILineSegment;

		for (let i = 0; i < parentPolygon.length; ++i)
		{
			lineA = {
				A: {
					x: parentPolygon[i].x,
					y: parentPolygon[i].y
				},
				B: {
					x: parentPolygon[(i + 1) % parentPolygon.length].x, // we include the last with the first point like this
					y: parentPolygon[(i + 1) % parentPolygon.length].y
				}
			};

			for (let j = 0; j < childPolygon.length; ++j)
			{
				lineB = {
					A: {
						x: childPolygon[j].x,
						y: childPolygon[j].y
					},
					B: {
						x: childPolygon[(j + 1) % childPolygon.length].x,
						y: childPolygon[(j + 1) % childPolygon.length].y
					}
				};

				if (THREEUtils.doesLineSegmentIntersectLineSegment(lineA, lineB))
				{
					return false;
				}
			}
		}

		return true;
	}
}