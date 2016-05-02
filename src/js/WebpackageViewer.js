/**
 * Created by ega on 20.04.2016.
 */
/*global $, JSONEditor, location, d3, klay*/
'use strict';
/**
 * @Class WebpackageViewer
 * Load the Webpackage Viewer
 * @constructor
 * @param {string} structureHolderId Id of the html element that holds the structure view
 * @param {string} dataflowHolderId Id of the html element that holds the dataflow view
 */
var WebpackageViewer = function (structureHolderId, dataflowHolderId) {
  this.structureHolderId = structureHolderId;
  this.dataflowHolderId = dataflowHolderId;
  this.dataflowViewWidth = 800;
  this.dataflowViewHeight = 500;
  var self = this;
  var zoom = d3.behavior.zoom()
    .on('zoom', function () {
      self.svg.attr('transform', 'translate(' + d3.event.translate + ')' + ' scale(' + d3.event.scale + ')');
    });
  this.svg = d3.select('#' + this.dataflowHolderId).select('.modal-body')
    .append('svg')
    .attr('width', '100%')
    .attr('height', this.dataflowViewHeight)
    .call(zoom)
    .append('g');
};

WebpackageViewer.prototype.constructor = WebpackageViewer;

/**
 * Load the structureView which is a json-editor
 * @param {object} schema JSON schema of the structureView
 */
WebpackageViewer.prototype.loadStructureView = function (schema) {
  this.setStructureViewOptions();
  this.structureView = new JSONEditor(document.getElementById(this.structureHolderId), {
    theme: 'bootstrap3',
    iconlib: 'bootstrap3',
    disable_array_reorder: true,
    no_additional_properties: true,
    disable_edit_json: true,
    disable_properties: true,
    keep_oneof_values: false,
    schema: schema
  });
};

/**
 * Set the json-editors' default options.
 */
WebpackageViewer.prototype.setStructureViewOptions = function () {
  JSONEditor.defaults.editors.array.options.collapsed = true;
  JSONEditor.defaults.editors.table.options.collapsed = true;
};

/**
 * Load the manifest.webpackage file retrieving its path from the url
 */
WebpackageViewer.prototype.loadManifest = function () {
  var self = this;
  $.getJSON(this.$_GET('webpackage'), function (response) {
    self.structureView.setValue(response);
    $('[data-toggle="popover"]').popover();
    self.addViewDataflowButtons();
  });
};

/**
 * Load the JSON schema file retrieving its path from the url.
 * Additionally add format to the schema for its representation
 */
WebpackageViewer.prototype.loadSchema = function () {
  var self = this;
  $.getJSON(this.$_GET('schema'), function (response) {
    var schema = response;

    for (var prop in schema.properties.artifacts.properties) {
      schema.properties.artifacts.properties[prop].format = 'tabs';
    }
    schema.properties.contributors.format = 'table';
    schema.properties.author.format = 'grid';

    var artifacts = ['appArtifact', 'elementaryArtifact', 'compoundArtifact'];
    for (var i in artifacts) {
      schema.definitions[artifacts[i]].properties.runnables.format = 'table';
      schema.definitions[artifacts[i]].properties.endpoints.format = 'tabs';
    }
    schema.definitions.elementaryArtifact.properties.slots.format = 'tabs';
    schema.definitions.compoundArtifact.properties.slots.format = 'tabs';
    schema.definitions.compoundArtifact.properties.members.format = 'table';
    schema.definitions.compoundArtifact.properties.connections.format = 'tabs';
    schema.definitions.compoundArtifact.properties.inits.format = 'table';
    // schema.format = 'grid';
    self.loadStructureView(schema);
  });
};

/**
 * Read url get parameters, similar to PHP.
 * Source: https://www.creativejuiz.fr/blog/en/javascript-en/read-url-get-parameters-with-javascript
 * @param {string} param name of the parameter to read
 * @returns {*} the value of the parameter or an empty object if the parameter was not in the url
 */
WebpackageViewer.prototype.$_GET = function (param) {
  var vars = {};
  window.location.href.replace(location.hash, '').replace(
    /[?&]+([^=&]+)=?([^&]*)?/gi, // regexp
    function (m, key, value) { // callback
      vars[key] = value !== undefined ? value : '';
    }
  );

  if (param) {
    return vars[param] ? vars[param] : null;
  }
  return vars;
};

/**
 * Add a button to each compound components view, to display its dataflow view
 */
WebpackageViewer.prototype.addViewDataflowButtons = function () {
  var compoundComponents = this.structureView.getValue().artifacts.compoundComponents;
  var dataflowHolderId = this.dataflowHolderId;
  var viewDataflowButton;
  var viewIcon;
  var compoundLabel;
  var self = this;
  for (var i in compoundComponents) {
    viewDataflowButton = document.createElement('button');
    viewDataflowButton.setAttribute('type', 'button');
    viewDataflowButton.setAttribute('class', 'btn btn-primary');
    viewDataflowButton.setAttribute('data-toggle', 'modal');
    viewDataflowButton.setAttribute('data-compound-index', i);
    viewIcon = document.createElement('i');
    viewIcon.setAttribute('class', 'glyphicon glyphicon-eye-open');
    viewDataflowButton.appendChild(viewIcon);
    viewDataflowButton.appendChild(document.createTextNode('View diagram'));
    viewDataflowButton.onclick = function () {
      var dataflowHolder = $('#' + dataflowHolderId);
      self.drawDataflow(self.generateDataflowGraph($(this).attr('data-compound-index'), self.structureView.getValue()));
      dataflowHolder.modal('show');
    };
    compoundLabel = $('[data-schemapath="root.artifacts.compoundComponents.' + i + '"]').find('label:first');
    compoundLabel.append(viewDataflowButton);
  }
};

/**
 * Generate the KGraph that represents to the dataflow of a compound component
 * @param {number} index Index of the compound component in compoundComponents array of manifest.artifacts
 * @param {object} manifest Manifest object contain in the manifest.webpackage file
 * @returns {{id: string, children: Array}} Kgraph to be used to build and display the dataflow view
 */
WebpackageViewer.prototype.generateDataflowGraph = function (index, manifest) {
  var dataflowGraph = {id: 'root', children: []};
  var compoundComponent = manifest.artifacts.compoundComponents[index];
  var rootComponentPorts = [];

  var port;
  for (var i in compoundComponent.slots) {
    for (var j in compoundComponent.slots[i].direction) {
      port = {
        id: compoundComponent.slots[i].slotId + '_' + compoundComponent.slots[i].direction[j],
        properties: {
          portSide: (compoundComponent.slots[i].direction[j] === 'input') ? 'WEST' : 'EAST'
        },
        labels: [{text: compoundComponent.slots[i].slotId}],
        width: 10
        // labels: [{text: compoundComponent.slots[i].slotId +'_' +compoundComponent.slots[i].direction[j]}]
      };
      rootComponentPorts.push(port);
    }
  }

  var childComponentId;
  var memberId;
  var childComponent;
  var childPorts;
  var childPort;
  var component;
  var childComponents = [];
  for (var k in compoundComponent.members) {
    // TODO: this/ and external components
    childPorts = [];
    childComponentId = compoundComponent.members[k].componentId.replace('this/', '');
    memberId = compoundComponent.members[k].memberId;
    component = this.searchComponentIn(childComponentId, manifest.artifacts.elementaryComponents);
    if (!component) {
      component = this.searchComponentIn(childComponentId, manifest.artifacts.compoundComponents);
    }

    var maxPortWidth = 0;
    var portWidth;
    for (var l in component.slots) {
      for (var m in component.slots[l].direction) {
        portWidth = component.slots[l].slotId.length * 5;
        maxPortWidth = Math.max(portWidth, maxPortWidth);
        childPort = {
          id: component.slots[l].slotId + '_' + memberId + '_' + component.slots[l].direction[m],
          properties: {
            portSide: (component.slots[l].direction[m] === 'input') ? 'WEST' : 'EAST'
          },
          labels: [{
            text: component.slots[l].slotId,
            width: portWidth,
            height: 10
          }],
          width: 2
          // labels: [{text: component.slots[l].slotId + '_' + memberId + '_' + component.slots[l].direction[m]}]
        };
        childPorts.push(childPort);
      }
    }

    var titleWidth = component.artifactId.length * 7;
    childComponent = {
      id: memberId,
      labels: [{text: component.artifactId, width: titleWidth, height: 10}],
      width: Math.max(maxPortWidth * 2 + 20, titleWidth),
      height: childPorts.length * 15 + 40,
      ports: childPorts,
      properties: {
        portConstraints: 'FIXED_SIDE',
        portLabelPlacement: 'INSIDE',
        nodeLabelPlacement: 'INSIDE H_CENTER V_TOP',
        portAlignment: 'CENTER',
        portSpacing: 13
      }
    };
    childComponents.push(childComponent);
  }

  var edge;
  var rootEdges = [];
  for (var n in compoundComponent.connections) {
    var source;
    var sourcePort;
    if (compoundComponent.connections[n].source.memberIdRef) {
      source = compoundComponent.connections[n].source.memberIdRef;
      sourcePort = compoundComponent.connections[n].source.slot + '_' + compoundComponent.connections[n].source.memberIdRef + '_' + 'output';
    } else {
      source = compoundComponent.artifactId;
      sourcePort = compoundComponent.connections[n].source.slot + '_' + 'input';
    }
    var target;
    var targetPort;
    if (compoundComponent.connections[n].destination.memberIdRef) {
      target = compoundComponent.connections[n].destination.memberIdRef;
      targetPort = compoundComponent.connections[n].destination.slot + '_' + compoundComponent.connections[n].destination.memberIdRef + '_' + 'input';
    } else {
      target = compoundComponent.artifactId;
      targetPort = compoundComponent.connections[n].destination.slot + '_' + 'output';
    }
    edge = {
      id: compoundComponent.connections[n].connectionId,
      labels: [{
        text: compoundComponent.connections[n].connectionId,
        width: compoundComponent.connections[n].connectionId.length * 5,
        height: 10
      }],
      source: source,
      sourcePort: sourcePort,
      target: target,
      targetPort: targetPort
    };
    rootEdges.push(edge);
  }

  var rootComponent = {
    id: compoundComponent.artifactId,
    labels: [{text: compoundComponent.artifactId, width: 130, height: 20}],
    ports: rootComponentPorts,
    properties: {
      portConstraints: 'FIXED_SIDE',
      portLabelPlacement: 'INSIDE',
      nodeLabelPlacement: 'INSIDE,H_CENTER,V_TOP',
      portAlignment: 'CENTER',
      portSpacing: 13,
      borderSpacing: 40
    },
    children: childComponents
  };

  dataflowGraph.children.push(rootComponent);
  dataflowGraph.edges = rootEdges;
  return dataflowGraph;
};

/**
 * Search a component in a components list using its id
 * @param {string} componentId Id of the component to be searched
 * @param {array} componentsList Array where the component will be searched
 * @returns {*}
 */
WebpackageViewer.prototype.searchComponentIn = function (componentId, componentsList) {
  for (var i in componentsList) {
    if (componentsList[i].artifactId === componentId) {
      return componentsList[i];
    }
  }
  return false;
};

/**
 * Build and append all the graphic elements of the dataflow view described by a Kgraph
 * @param {object} dataflowGraph JSON Kgraph to be displayed
 */
WebpackageViewer.prototype.drawDataflow = function (dataflowGraph) {
// group
  var root = this.svg.append('g');
  var layouter = klay.d3kgraph()
    .size([this.dataflowViewWidth, this.dataflowViewHeight])
    .transformGroup(root)
    .options({
      layoutHierarchy: true,
      intCoordinates: true,
      direction: 'RIGHT',
      edgeRouting: 'ORTHOGONAL',
      nodeLayering: 'NETWORK_SIMPLEX',
      nodePlace: 'BRANDES_KOEPF',
      crossMin: 'LAYER_SWEEP',
      algorithm: 'de.cau.cs.kieler.klay.layered'
    });

  var self = this;
  layouter.on('finish', function (d) {
    var components = layouter.nodes();
    var connections = layouter.links(components);

    var componentsData = root.selectAll('.node')
      .data(components, function (d) { return d.id; });

    var connectionsData = root.selectAll('.link')
      .data(connections, function (d) { return d.id; });

    self.drawComponents(componentsData);
    self.drawComponentsSlots(componentsData);
    self.drawConnections(connectionsData);
  });

  layouter.kgraph(dataflowGraph);
};

/**
 * Draw a square for each component and its id as label
 * @param {Object} componentsData Data of each component (D3)
 */
WebpackageViewer.prototype.drawComponents = function (componentsData) {
  var componentView = componentsData.enter()
    .append('g')
    .attr('class', function (d) {
      if (d.children) {
        return 'componentView compound';
      } else {
        return 'componentView leaf';
      }
    });

  var atoms = componentView.append('rect')
    .attr('class', 'componentViewAtom')
    .attr('width', 10)
    .attr('height', 10);

  atoms.transition()
    .attr('width', function (d) { return d.width; })
    .attr('height', function (d) { return d.height; });

  // Apply componentView positions
  componentView.transition()
    .attr('transform', function (d) {
      return 'translate(' + (d.x || 0) + ' ' + (d.y || 0) + ')';
    });

  // Nodes labels
  var componentViewLabel = componentView.selectAll('.componentViewLabel')
    .data(function (d) {
      return d.labels || [];
    })
    .enter()
    .append('text')
    .text(function (d) {
      return d.text;
    })
    .attr('class', 'componentViewLabel');

  componentViewLabel.transition()
    .attr('height', function (d) { return d.height; });

  componentViewLabel.transition()
    .attr('x', function (d) { return d.x; })
    .attr('y', function (d) { return d.y + d.height; });
};

/**
 * Draw the components' slots and their ids as labels
 * @param {Object} componentsData Data of each component (D3)
 */
WebpackageViewer.prototype.drawComponentsSlots = function (componentsData) {
  // slots
  var slotView = componentsData.selectAll('.slotView')
    .data(function (d) { return d.ports || []; })
    .enter()
    .append('g')
    .attr('class', 'slotView');

  slotView.append('circle')
    .attr('class', 'slotViewAtom');
  slotView.transition()
    .attr('transform', function (d) {
      return 'translate(' + (d.x || 0) + ' ' + (d.y || 0) + ')';
    });

  // slots labels
  var slotViewLabel = slotView.selectAll('.slotViewLabel')
    .data(function (d) { return d.labels; })
    .enter()
    .append('text')
    .text(function (d) { return d.text; })
    .attr('class', 'slotViewLabel');
  slotViewLabel.transition()
    .attr('x', function (d) {
      return d.x;
    })
    .attr('y', function (d) { return d.y + 7; });
};

/**
 * Draw the connections and their ids as labels
 * @param {Object} connectionData Data of each connection (D3)
 */
WebpackageViewer.prototype.drawConnections = function (connectionData) {
  // build the arrow.
  this.svg.append('svg:defs').selectAll('marker')
    .data(['end'])                 // define connectionView/path types
    .enter().append('svg:marker')    // add arrows
    .attr('id', String)
    .attr('class', 'arrowEnd')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 10)
    .attr('refY', 0)
    .attr('markerWidth', 5)        // marker settings
    .attr('markerHeight', 5)
    .attr('orient', 'auto')  // arrowhead color
    .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5');

  // Add connections arrows
  var connectionView = connectionData.enter()
    .append('path')
    .attr('class', 'connectionView')
    .attr('d', 'M0 0')
    .attr('marker-end', 'url(#end)');

  // Add connections labels
  var connectionViewLabel = connectionData.enter()
    .append('text')
    .attr('class', 'connectionViewLabel')
    .text(function (d) { return d.labels[0].text || ''; });

  // Apply connections routes
  connectionView.transition().attr('d', function (d) {
    var path = '';
    path += 'M' + (d.sourcePoint.x + 3) + ' ' + d.sourcePoint.y + ' ';
    (d.bendPoints || []).forEach(function (bp, i) {
      path += 'L' + bp.x + ' ' + bp.y + ' ';
    });
    path += 'L' + (d.targetPoint.x - 5) + ' ' + d.targetPoint.y + ' ';
    return path;
  });

  connectionViewLabel.transition()
    .attr('x', function (d) { return d.labels[0].x; })
    .attr('y', function (d) { return d.labels[0].y + d.labels[0].height * 2.5; });
};
