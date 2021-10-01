import * as azmaps from 'azure-maps-control';
import { GridType } from '../Enums/GridType';
import { GridMath, GridInfo } from '../helpers/GridMath';

/**
 * Options for a gridded data source.
 */
export interface GriddedDataSourceOptions {

    /*
    * Defines custom properties that are calculated using expressions against all the points within each grid cell and added to the properties of each grid cell polygon.
    */
    aggregateProperties?: Record<string, azmaps.AggregateExpression>;

    /* The shape of the data bin to generate. Default: `hexagon` */
    gridType?: GridType;

    /*
    * The spatial width of each cell in the grid in the specified distance units. Default: `25000`
    */
    cellWidth?: number;

    /** The minimium cell width to use by the coverage and scaling operations. Will be snapped to the `cellWidth` if greater than that value. Default: `0` */
    minCellWidth?: number;

    /* The distance units of the cellWidth option. Default: `meters` */
    distanceUnits?: azmaps.math.DistanceUnits;

    /**
     * Maximum zoom level at which to create vector tiles (higher means greater detail at high zoom levels). Default: `18`
     */
    maxZoom?: number;

    /**
     * The aggregate property to calculate the min/max values over the whole data set. Can be an aggregate property or `point_count`.
     */
    scaleProperty?: string;

    /**
    * A data driven expression that customizes how the scaling function is done. This expression has access to the properties of the cell (CellInfo) and the following two properties; 
    * `min` - The minimium aggregate value across all cells in the data source.
    * `max` - The maximium aggregate value across all cells in the data source.
    * A linear scaling function based on the "point_count" property is used by default `scale = (point_count - min)/(max - min)`. 
    * Default: `['/', ['-', ['get', 'point_count'], ['get', 'min']], ['-',  ['get', 'max'], ['get', 'min']]]`
    */
    scaleExpression?: azmaps.Expression;

    /** 
     * A number between 0 and 1 that specifies how much area a cell polygon should consume within the grid cell. 
     * This applies a multiplier to the scale of all cells. If `scaleProperty` is specified, this will add additional scaling. 
     * Default: `1` 
     */
    coverage?: number;

    /**
     * The latitude value used to calculate the pixel equivalent of the cellWidth. Default: `0`
     */
    centerLatitude?: number;
}

/**
 * A data source for aggregating point data into cells of a grid system. 
 * Point features will be extracted from atlas.Shape objects, but this shape will not be data bound.
 */
export class GriddedDataSource extends azmaps.source.DataSource {

    /***********************************
     * Private properties
     ***********************************/

    /** Options for the data source. */
    private _options: GriddedDataSourceOptions = {
        maxZoom: 18,
        cellWidth: 25000,
        minCellWidth: 0,
        distanceUnits: <azmaps.math.DistanceUnits>'meters',
        gridType: <GridType>'hexagon',
        coverage: 1,
        centerLatitude: 0
    };

    /** The points in the data source. */
    private _points: azmaps.data.Feature<azmaps.data.Point, any>[] = [];

    /** The pixels of each point. */
    private _pixels: azmaps.Pixel[] = [];

    /** The grid state information. */
    private _gridInfo: GridInfo;

    /** Request id for updates to the rendering. This is used to throttle render updates. */
    private _requestId: number;

    /***********************************
     * Constructor
     ***********************************/

    /**
      * A data source class that makes it easy to manage shapes data that will be displayed on the map.
      * A data source must be added to a layer before it is visible on the map.
      * The `DataSource` class may be used with the `SymbolLayer`, `LineLayer`, `PolygonLayer`, `BubbleLayer`, and `HeatMapLayer`.
      * @param id a unique id that the user assigns to the data source. If this is not specified, then the data source will automatically be assigned an id.
      * @param options the options for the data source.
      */
    constructor(id?: string, options?: GriddedDataSourceOptions) {
        super(id);

        if (options) {
            Object.assign(this._options, options);
            //Set the buffer to 8 since the data 
            super.setOptions(Object.assign({ buffer: 8, tolerance: 0 }, options));
        }
    }

    /***********************************
     * Public functions
     ***********************************/

    /**
     * Adds points to the data source.
     * @param points The points to add to the data source.
     */
    public add(points: azmaps.data.FeatureCollection | azmaps.data.Feature<azmaps.data.Point, any> | azmaps.data.Point | azmaps.Shape | Array<azmaps.data.Feature<azmaps.data.Point, any> | azmaps.data.Point | azmaps.Shape>): void {
        this._addPoints(points);
        this._recalculate();
    }

    /**
     * Removes all data in the data source.
     */
    public clear(): void {
        this._points = [];
        this._pixels = [];
        super.clear();
    }

    /**
     * Cleans up any resources this data source is consuming.
     */
    public dispose(): void {
        this.clear();
        super.dispose();

        Object.keys(this).forEach(k => this[k] = null);
    }

    /**
     * Gets all points that are within the specified grid cell.
     * @param cell_id The grid cell id.
     */
    public getCellChildren(cell_id: string): azmaps.data.Feature<azmaps.data.Point, any>[] {
        const pointIdx = this._gridInfo.pointLookupTable[cell_id];
        let points = [];

        if (pointIdx) {
            for (let i = 0, len = pointIdx.length; i < len; i++) {
                points.push(this._points[pointIdx[i]]);
            }
        }

        return JSON.parse(JSON.stringify(points));
    }

    /**
     * Gets all grid cell polygons as a GeoJSON FeatureCollection.
     */
    public getGridCells(): azmaps.data.FeatureCollection {
        return super.toJson();
    }

    /**
     * Gets the options used by the data source.
     */
    public getOptions(): GriddedDataSourceOptions {
        return Object.assign({}, this._options);
    }

    /**
     * Gets all points as a GeoJSON FeatureCollection.
     */
    public getPoints(): azmaps.data.FeatureCollection {
        return new azmaps.data.FeatureCollection(JSON.parse(JSON.stringify(this._points)));
    }

    /**
     * Downloads a GeoJSON document and imports its data into the data source.
     * The GeoJSON document must be on the same domain or accessible using CORS.
     * @param url The URL to the GeoJSON document.
     */
    public importDataFromUrl(url: string): Promise<void> {
        const self = this;

        return new Promise((resolve, reject) => {
            super.clear();
            super.importDataFromUrl(url).then(() => {
                //Grab the data as GeoJSON and pass it into the add function.
                self._addPoints(super.toJson());
                self._recalculate();
                resolve();
            }, () => { reject() });
        });
    }

    /**
     * Removes one or more points from the data source.
     * If a string is passed in, it is assumed to be an id.
     * If a number is passed in, removes the point at that index.
     * @param point The point(s), point id(s), or feature(s) to be removed
     */
    public remove(point: number | string | azmaps.data.Feature<azmaps.data.Point, any> | azmaps.Shape | Array<number | string | azmaps.data.Feature<azmaps.data.Point, any>> | azmaps.Shape): void {
        this._remove(point);
        this._recalculate();
    }

    /**
     * Removes one or more points from the datasource based on its id.
     * @param shape shape id
     */
    public removeById(id: number | string | Array<number | string>): void {
        this._remove(id);
        this._recalculate();
    }

    /**
     * Sets the data source options.
     * The data source will retain its current values for any option not specified in the supplied options.
     * @param options The options to be set.
     */
    public setOptions(options: GriddedDataSourceOptions): void {
        if (options) {
            const self = this;
            const opt = self._options;
            let superOptions: azmaps.DataSourceOptions = {};
            let coordCalcNeeded = false;
            let fullCalcNeeded = false;

            if (typeof options.maxZoom === 'number' && options.maxZoom >= 0 && options.maxZoom < 25 && options.maxZoom !== opt.maxZoom) {
                opt.maxZoom = options.maxZoom;
                superOptions.maxZoom = options.maxZoom;
                //No recalculation required.
            }

            if (typeof options.cellWidth === 'number' && options.cellWidth > 0 && options.cellWidth !== opt.cellWidth) {
                opt.cellWidth = options.cellWidth;
                //Requires a full recalulation.
                fullCalcNeeded = true;
            }

            if (typeof options.minCellWidth === 'number' && options.minCellWidth >= 0 && options.minCellWidth !== opt.minCellWidth) {
                opt.minCellWidth = options.minCellWidth;
                //Only requires recalculating coordinates of cell.
                coordCalcNeeded = true;
            }

            if (options.centerLatitude !== undefined && options.centerLatitude !== opt.centerLatitude) {
                opt.centerLatitude = options.centerLatitude;
                //Requires a full recalulation.
                fullCalcNeeded = true;
            }

            if (options.distanceUnits && options.distanceUnits !== opt.distanceUnits) {
                opt.distanceUnits = options.distanceUnits;
                //Requires a full recalulation.
                fullCalcNeeded = true;
            }

            if (options.gridType && options.gridType !== opt.gridType) {
                const sq = ['square', 'circle'];
                const hx = ['hexagon', 'hexCircle'];

                //Check to see if old and new grid types are based on the same grid system. Such as square/circle, or hexagon/hexCircle.
                if ((hx.indexOf(opt.gridType) > -1 && hx.indexOf(options.gridType) > -1) ||
                    (sq.indexOf(opt.gridType) > -1 && sq.indexOf(options.gridType) > -1)) {
                    //Only need to recalculate coords.
                    coordCalcNeeded = true;
                } else {
                    //Requires a full recalulation.
                    fullCalcNeeded = true;
                }

                opt.gridType = options.gridType;
            }

            if (options.aggregateProperties !== undefined) {
                opt.aggregateProperties = options.aggregateProperties;
                //Requires a full recalulation. 
                fullCalcNeeded = true;
            }

            if (options.scaleExpression !== undefined && options.scaleExpression !== opt.scaleExpression) {
                opt.scaleExpression = options.scaleExpression;
                //Only need to recalculate coords if, the scaleProperty is set or will be set.
                if (options.scaleProperty || opt.scaleProperty) {
                    coordCalcNeeded = true;
                }
            }

            if (options.scaleProperty !== undefined && options.scaleProperty !== opt.scaleProperty) {
                opt.scaleProperty = options.scaleProperty;

                if (options.scaleProperty === null || options.scaleProperty === 'point_count') {
                    //Only need to recalculate coords.
                    coordCalcNeeded = true;
                } else {
                    //Requires a full recalulation.
                    fullCalcNeeded = true;
                }
            }

            if (options.coverage !== undefined && options.coverage !== opt.coverage) {
                opt.coverage = options.coverage;
                //Only need to recalculate coords.
                coordCalcNeeded = true;
            }

            if (Object.keys(superOptions).length > 0) {
                super.setOptions(superOptions);
            }

            if (fullCalcNeeded || !self._gridInfo) {
                self._recalculate();
            } else if (coordCalcNeeded) {
                self._recalculateCoords();
            }
        }
    }

    /**
     * Overwrites all points in the data source with the new array of points.
     * @param points The new points to add.
     */
    public setPoints(points: azmaps.data.FeatureCollection | Array<azmaps.data.Feature<azmaps.data.Point, any> | azmaps.data.Point | azmaps.Shape>): void {
        const self = this;
        self._points = [];
        self._pixels = [];
        self._addPoints(points);
        self._recalculate();
    }

    /***********************************
     * Private functions
     ***********************************/

    /**
     * Adds points to the data source.
     * @param points The points to add to the data source.
     * @param recalculate Specifies if the data bins should be recalculated.
     */
    private _addPoints(points: azmaps.data.FeatureCollection | azmaps.data.Feature<azmaps.data.Geometry, any> | azmaps.data.Geometry | Array<azmaps.data.Feature<azmaps.data.Geometry, any> | azmaps.data.Point | azmaps.Shape> | azmaps.Shape): void {
        const self = this;
        const pt = self._points;
        const px = self._pixels;
        const normalize = self._normalizeGetPixel22;

        if ((<azmaps.data.FeatureCollection>points).type === 'FeatureCollection') {
            points = (<azmaps.data.FeatureCollection>points).features;
        }

        if (Array.isArray(points)) {
            //Filter the data in the array and only add point geometry features.
            for (let i = 0, len = points.length; i < len; i++) {
                self._addPoints(points[i]);
            }
        } else if (points instanceof azmaps.Shape) {
            if (points.getType() === 'Point') {
                px.push(normalize(<azmaps.data.Position>points.getCoordinates()));
                pt.push(<azmaps.data.Feature<azmaps.data.Point, any>>points.toJson());
            }
        } else if (points.type === 'Feature' && (<azmaps.data.Feature<azmaps.data.Point, any>>points).geometry.type === 'Point') {
            const f = <azmaps.data.Feature<azmaps.data.Point, any>>points;
            px.push(normalize(f.geometry.coordinates));
            pt.push(f);
        } else if (points.type === 'Point') {
            //Convert raw points into features.
            const p = <azmaps.data.Point>points;
            px.push(normalize(p.coordinates));
            pt.push(new azmaps.data.Feature(p));
        }
    }

    /**
     * Normalizes the coordinates of a point and returns the pixel value at zoom 22.
     * @param pos Position to normalize.
     */
    private _normalizeGetPixel22(pos: azmaps.data.Position): azmaps.Pixel {
        pos[0] = azmaps.math.normalizeLongitude(pos[0]);
        pos[1] = azmaps.math.normalizeLatitude(pos[1]);

        return GridMath.toPixel22(pos);
    }

    /**
     * Removes one or more points from the data source.
     * If a string is passed in, it is assumed to be an id.
     * If a number is passed in, removes the point at that index.
     * @param point The point(s), point id(s), or feature(s) to be removed
     * @param recalculate Specifies if the data bins should be recalculated.
     */
    private _remove(point: number | string | azmaps.data.Feature<azmaps.data.Point, any> | azmaps.Shape | Array<number | string | azmaps.data.Feature<azmaps.data.Point, any> | azmaps.Shape>): void {
        const self = this;
        const pt = self._points;

        if (Array.isArray(point)) {
            for (let i = 0, len = point.length; i < len; i++) {
                self._remove(point[i]);
            }
        } else if (point instanceof azmaps.Shape) {
            const id = point.getId();

            for (let i = 0, len = pt.length; i < len; i++) {
                if (pt[i].id === id) {
                    self._remove(i);
                    break;
                }
            }
        } else if (typeof point === 'number') {
            if (point < pt.length) {
                pt.splice(point, 1);
            }
        } else if (typeof point === 'string') {
            for (let i = 0, len = pt.length; i < len; i++) {
                if (pt[i].id === point) {
                    self._remove(i);
                    break;
                }
            }
        } else if (point.type === 'Feature') {
            const idx = pt.indexOf(point);
            self._remove(idx);
        }
    }

    /**
     * Recalculates the grid.
     */
    private _recalculate(): void {
        const self = this;

        //Throttling logic to prevent performance issues caused by multiple recalulation requests in a short period of time. i.e. Calling the add function in a loop.
        if (this._requestId !== undefined) {
            return;
        } else {
            self._requestId = requestAnimationFrame(() => {
                self._gridInfo = GridMath.calculateGrid(self._points, self._pixels, self._options);
                self._updateCells();
                self._requestId = undefined;
            });
        }
    }

    /**
     * Recalculates the cell coordinates. This is done when the same grid system is used, and the only change is related to scaling or representing cells differently (hex -> hex circle)
     */
    private _recalculateCoords(): void {
        const self = this;
        GridMath.recalculateCoords(self._gridInfo, self._options);
        self._updateCells();
    }

    /** Updates the data source with the newly calculated cells. */
    private _updateCells(): void {
        super['_clearNoUpdate']();
        super.add(this._gridInfo.cells);
    }
}