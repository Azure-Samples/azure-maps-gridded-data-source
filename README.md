---
page_type: sample
description: A module for the Azure Maps Web SDK that provides a data source that clusters data points into cells of a grid area.
languages:
- javascript
- typescript
products:
- azure
- azure-maps
---

# Azure Maps Gridded Data Source module

A module for the Azure Maps Web SDK that provides a data source that clusters data points into cells of a grid area.

This operation is also known by many names such as tessellations, data binning, or hex bins. 

A couple of the key features of this module:

- Generates pixel accurate cells for better visual appearance. Spatially accurate grids on a Web Mercator map are stretched and skewed which is less visually appelling. 
- Uses an index based clustering method for high performance rather than a point in polygon method.
- Supports aggregate properties that calculates aggregate values from properties of all points within each grid cell, similar to the clustering functionality of a `DataSource`.
- Grid cell polygons clipped at anti-merdian to ensure no overlapping of cells.
- 6 different grid types:

| Name | Image | Description | 
|-------|------|-------------|
| Hexagon | ![hexagon grid](https://github.com/Azure-Samples/azure-maps-gridded-data-source/blob/main/docs/images/hexagon.png) | A haxagon grid where the top of the hexagon is flat. |
| Pointy hexagon | ![pointy hexagon grid](https://github.com/Azure-Samples/azure-maps-gridded-data-source/blob/main/docs/images/pointyhexagon.png) | A haxagon grid where the top of the hexagon is pointy. |
| Square | ![square grid](https://github.com/Azure-Samples/azure-maps-gridded-data-source/blob/main/docs/images/square.png) | A sguare grid. |
| Triangle | ![triangle grid](https://github.com/Azure-Samples/azure-maps-gridded-data-source/blob/main/docs/images/triangle.png) | A triangular grid. |
| Circle | ![circle grid](https://github.com/Azure-Samples/azure-maps-gridded-data-source/blob/main/docs/images/circle.png) | A square grid where cells are converted into circles. The circle does not cover the entire area the cell represents, but does include all points that would fall within the specified grid cell. |
| Hexagon circle  | ![hexagon circle grid](https://github.com/Azure-Samples/azure-maps-gridded-data-source/blob/main/docs/images/hexcircle.png) | A haxagon grid where cells are converted into circles. The circle does not cover the entire area the cell represents, but does include all points that would fall within the specified grid cell. |

**Credit**

A lot of the hexagon grid based algorithms came from this [awesome site](https://www.redblobgames.com/grids/hexagons/).

Triangle grid calculations are based on this [blog post](http://csharphelper.com/blog/2015/10/draw-a-triangular-grid-in-c/)

## Getting started

Download the project and copy the `azure-maps-gridded-data-source` JavaScript file from the `dist` folder into your project. 

See the [documentation](https://github.com/Azure-Samples/azure-maps-gridded-data-source/tree/main/docs) for more details on a specific feature or take a look at one of the samples below.

## Samples

[Extruded gridded data source](https://azuremapscodesamples.azurewebsites.net/index.html?sample=Extruded%20gridded%20data%20source)
<br/>[<img src="https://github.com/Azure-Samples/AzureMapsCodeSamples/raw/master/AzureMapsCodeSamples/SiteResources/screenshots/Extruded-gridded-data-source.jpg" height="200px">](https://azuremapscodesamples.azurewebsites.net/index.html?sample=Extruded%20gridded%20data%20source)

[Show points of gridded data source](https://azuremapscodesamples.azurewebsites.net/index.html?sample=Show%20points%20of%20gridded%20data%20source)
<br/>[<img src="https://github.com/Azure-Samples/AzureMapsCodeSamples/raw/master/AzureMapsCodeSamples/SiteResources/screenshots/Show-points-of-gridded-data-source.jpg" height="200px">](https://azuremapscodesamples.azurewebsites.net/index.html?sample=Show%20points%20of%20gridded%20data%20source)

[Gridded data source options](https://azuremapscodesamples.azurewebsites.net/index.html?sample=Gridded%20data%20source%20options)
<br/>[<img src="https://github.com/Azure-Samples/AzureMapsCodeSamples/raw/master/AzureMapsCodeSamples/SiteResources/screenshots/Gridded-data-source-options.jpg" height="200px">](https://azuremapscodesamples.azurewebsites.net/index.html?sample=Gridded%20data%20source%20options)

## Ideas for enhancements

- Use of web workers for large data sets.
- Offloading calculations to WebGL.
- Option for geospatially accurate grids.
- Polygon mask to clip to.

## Related Projects

**Open Azure Maps Web SDK modules**

* [Azure Maps Animation module](https://github.com/Azure-Samples/azure-maps-animations)
* [Azure Maps Geolocation Control module](https://github.com/Azure-Samples/azure-maps-geolocation-control)
* [Azure Maps Fullscreen Control module](https://github.com/Azure-Samples/azure-maps-fullscreen-control)
* [Azure Maps Selection Control module](https://github.com/Azure-Samples/azure-maps-selection-control)
* [Azure Maps Services UI module](https://github.com/Azure-Samples/azure-maps-services-ui)
* [Azure Maps Sync Map module](https://github.com/Azure-Samples/azure-maps-sync-maps)

**Additional projects**

* [Azure Maps Web SDK Samples](https://github.com/Azure-Samples/AzureMapsCodeSamples)
* [Azure Maps Gov Cloud Web SDK Samples](https://github.com/Azure-Samples/AzureMapsGovCloudCodeSamples)
* [Azure Maps & Azure Active Directory Samples](https://github.com/Azure-Samples/Azure-Maps-AzureAD-Samples)
* [List of open-source Azure Maps projects](https://github.com/microsoft/Maps/blob/master/AzureMaps.md)

## Additional Resources

* [Azure Maps (main site)](https://azure.com/maps)
* [Azure Maps Documentation](https://docs.microsoft.com/azure/azure-maps/index)
* [Azure Maps Blog](https://azure.microsoft.com/blog/topics/azure-maps/)
* [Microsoft Q&A](https://docs.microsoft.com/answers/topics/azure-maps.html)
* [Azure Maps feedback](https://feedback.azure.com/forums/909172-azure-maps)

## Contributing

We welcome contributions. Feel free to submit code samples, file issues and pull requests on the repo and we'll address them as we can. 
Learn more about how you can help on our [Contribution Rules & Guidelines](https://github.com/Azure-Samples/azure-maps-gridded-data-source/blob/master/CONTRIBUTING.md). 

You can reach out to us anytime with questions and suggestions using our communities below:
* [Microsoft Q&A](https://docs.microsoft.com/answers/topics/azure-maps.html)
* [Azure Maps feedback](https://feedback.azure.com/forums/909172-azure-maps)

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). 
For more information, see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or 
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## License

MIT
 
See [License](https://github.com/Azure-Samples/azure-maps-gridded-data-source/blob/master/LICENSE.md) for full license text.
