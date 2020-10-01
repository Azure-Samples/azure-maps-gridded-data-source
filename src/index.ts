import { Namespace } from "./helpers/Namespace";

/* Build the structure of the SDK */

//Merge the local controls into the 'atlas.control' namespace.
import * as baseSource from "./source";
const source = Namespace.merge("atlas.source", baseSource);
export { source };

//Enums
export { GridType } from "./Enums/GridType";
