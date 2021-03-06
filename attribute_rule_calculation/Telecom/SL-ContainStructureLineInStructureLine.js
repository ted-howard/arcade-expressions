// Assigned To: StructureLine
// Name: Contain a Structure Line in Structure Line
// Description: Rule searches for structure line containers with a certain distance to contain the structure in it.
//              This supports adding a conduit or duct bank in a trench or tunnel and a lashing guy in a Aerial Span.
// Subtypes: All
// Field: Assetid
// Execute: Insert


// ***************************************

// This section has the functions and variables that need to be adjusted based on your implementation
// The field the rule is assigned to
var assigned_to_value = $feature.assetid;
// Limit the rule to valid subtypes
var valid_asset_groups = [102, 103, 109];
if (indexof(valid_asset_groups, $feature.assetgroup) == -1) {
    return assigned_to_value;
}
var valid_asset_types = [81, 121, 127];
if (Count(valid_asset_types) > 0 && indexof(valid_asset_types, $feature.assettype) == -1) {
    return assigned_to_value;
}

var structure_Line_class = 'StructureLine';
var filter_structure_lines_sql = "AssetGroup in (103, 104, 112) and AssetType in (101, 125, 221)";
// Set the container asset types that can only contain one child item
var restrict_to_one_content = [];
// Create a list of what items can be in what parent containers
var child_to_parent = {
    '121': [101, 221],
    '127': [125],
    '81': [101]
};
var feature_set = FeatureSetByName($datastore, 'StructureLine', ["OBJECTID", "GLOBALID", "ASSOCIATIONSTATUS", "AssetGroup", "AssetType"], true);
var search_distance = DefaultValue($feature.searchdistance, 75);
var search_unit = 9002;


// ************* End Section *****************
// Function to check if a bit is in an int value

function has_bit(num, test_value) {
    // num = number to test if it contains a bit
    // test_value = the bit value to test for
    // determines if num has the test_value bit set
    // Equivalent to num AND test_value == test_value

    // first we need to determine the bit position of test_value
    var bit_pos = -1;
    for (var i = 0; i < 64; i++) {
        // equivalent to test_value >> 1
        var test_value = Floor(test_value / 2);
        bit_pos++
        if (test_value == 0)
            break;
    }
    // now that we know the bit position, we shift the bits of
    // num until we get to the bit we care about
    for (var i = 1; i <= bit_pos; i++) {
        var num = Floor(num / 2);
    }

    if (num % 2 == 0) {
        return false
    } else {
        return true
    }

}


// Buffer the features to find features within a certain distance
var closest_features = Intersects(feature_set, Buffer(Geometry($feature), search_distance, search_unit));
//if (Count(closest_features) == 0) {
//    return assigned_to_value;
//}
// Filter the closest results based on the sql to get assets of a certain type
var filtered_features = Filter(closest_features, filter_structure_lines_sql);
var closest_structure_count = Count(filtered_features);
if (closest_structure_count == 0) {
    return assigned_to_value;
}
var line_geo = Geometry($feature);
var line_vertices = line_geo['paths'][0];
var vertex_count = Count(line_vertices);
var structure_containers = [];
var added_to = [];
for (var vert_idx = 0; vert_idx < vertex_count - 1; vert_idx++) {

    // Check to see if point is between vertexs
    var from_point = line_vertices[vert_idx];
    var to_point = line_vertices[vert_idx + 1];

    var segment = Polyline({
        'paths': [[[from_point.X, from_point.y], [to_point.X, to_point.Y]]],
        "spatialReference": {"wkid": line_geo.spatialReference.wkid}
    });

    var mid_point = Centroid(segment);
    for (var struct_feat in filtered_features) {
        // Check to see if the container is valid for the type
        if (IndexOf(child_to_parent[Text($feature.assettype)], struct_feat['AssetType']) == -1) {
            continue;
        }
        // If there is already content, and it is restricted to one item, skip it
        if (has_bit(struct_feat['ASSOCIATIONSTATUS'], 1) && indexof(restrict_to_one_content, struct_feat['AssetType']) >= 0) {
            continue;
        }
        if (Distance(struct_feat, mid_point, search_unit) < search_distance / 2) {
            var parent_globalid = struct_feat.globalid;
            // If the parent has already been added as a container, dont add it more than once
            if (IndexOf(added_to, parent_globalid) > -1) {
                continue;
            }

            added_to[Count(added_to)] = parent_globalid;
            structure_containers[Count(structure_containers)] = {
                'globalID': parent_globalid,
                'associationType': 'container'
            };
            break;
        }
    }
}
if (count(structure_containers) == 0) {
    return assigned_to_value;
}
var edit_payload = [
    {
        'className': structure_Line_class,
        'updates': structure_containers
    }
];

return {
    "result": assigned_to_value,
    "edit": edit_payload
};