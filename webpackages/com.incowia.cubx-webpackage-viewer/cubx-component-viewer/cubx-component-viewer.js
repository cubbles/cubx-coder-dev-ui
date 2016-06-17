/*global $, d3, klay*/
(function () {
  'use strict';
  /**
   * Get help:
   * > Lifecycle callbacks:
   * https://www.polymer-project.org/1.0/docs/devguide/registering-elements.html#lifecycle-callbacks
   *
   * Access the Cubbles-Component-Model:
   * > Access slot values:
   * slot 'a': this.getA(); | this.setA(value)
   */
  CubxPolymer({
    is: 'cubx-component-viewer',

    _cubxReady: false,
    DEFAULT_VIEWER_HEIGHT: window.innerHeight * 0.7,
    ROOT_BORDER_SPACE: 70,
    HEADER_MARGIN: 5,
    COMPONENT_LABEL_HEIGHT: 18,
    COMPONENT_LABEL_LETTER_WIDTH: 9,
    COMPOUND_TITLE: 'Dataflow view',
    ELEMENTARY_TITLE: 'Interface view',
    VIEW_HOLDER_CSS_CLASS: 'component_view_holder',
    SLOT_LABELS_SPACE: 10,
    SLOT_LABEL_LETTER_WIDTH: 7,
    SLOT_LABEL_HEIGHT: 11,
    SLOT_RADIUS: 5,
    SLOTS_AREA_MARGIN: 10,
    SLOT_SPACE: 11,
    CONNECTION_LABEL_LETTER_WIDTH: 6,
    CONNECTION_LABEL_MARGIN: 20,
    CONNECTION_HEIGHT: 10,

    /**
     * Manipulate an element’s local DOM when the element is created.
     */
    created: function () {
      this.SLOT_DIAMETER = this.SLOT_RADIUS * 2;
    },

    /**
     * Manipulate an element’s local DOM when the element is created and initialized.
     */
    ready: function () {
    },

    /**
     * Manipulate an element’s local DOM when the element is attached to the document.
     */
    attached: function () {
    },

    /**
     * Manipulate an element’s local DOM when the cubbles framework is initialized and ready to work.
     */
    cubxReady: function () {
      this._cubxReady = true;
    },

    /**
     *  Observe the Cubbles-Component-Model: If value for slot 'componentArtifactId' has changed ...
     */
    modelComponentArtifactIdChanged: function (componentArtifactId) {
      if (!this.getManifest() || !componentArtifactId) return;
      this._updateView();
    },

    /**
     *  Observe the Cubbles-Component-Model: If value for slot 'manifest' has changed ...
     */
    modelManifestChanged: function (manifest) {
      if (!this.getComponentArtifactId()) return;
      this._updateView();
    },

    /**
     * Update the view after the manifest or the componentArtifactId slots have changed
     * @private
     */
    _updateView: function () {
      var component = this._searchComponentInManifest(this.getComponentArtifactId(), this.getManifest());
      if (component) {
        this.setComponent(component);
        if (this.getShowTitle()) {
          $('#' + this.VIEW_HOLDER_CSS_CLASS + '_title').css('display', 'inline-block');
          if (component.members) {
            this.setViewerTitle(this.COMPOUND_TITLE);
          } else {
            this.setViewerTitle(this.ELEMENTARY_TITLE);
          }
        }
        this._drawComponent(this._generateComponentGraph());
      } else {
        console.error('The component with ' + this.getComponentArtifactId() + ' artifactId was not found');
        return;
      }
    },

    /**
     * Generate the KGraph that represents a component
     * @returns {{id: string, children: Array}} KGraph to be used to build and display the component
     * @private
     */
    _generateComponentGraph: function () {
      if (!this._cubxReady) { return; }
      var componentGraph = {id: 'root', children: []};
      var rootComponent = this._generateGraphMember(
        this.getComponent(),
        undefined,
        this.getManifest(),
        {portLabelPlacement: 'OUTSIDE', borderSpacing: this.ROOT_BORDER_SPACE}
      );
      rootComponent.children = this._generateGraphMembers(this.getComponent().members);

      componentGraph.children.push(rootComponent);
      componentGraph.edges = this._generateGraphConnections(this.getComponent().connections,
        this.getComponent().artifactId);
      return componentGraph;
    },

    /**
     * Generate a list of GraphMembers (KNodes) using a a list of components which belong to a compound component that
     * is defined in manifest
     * @param {Array} compoundsMembers - Components which belong to a compound component
     * @returns {Array} List of GraphMembers (KNodes)
     * @private
     */
    _generateGraphMembers: function (compoundsMembers) {
      var graphMember;
      var component;
      var manifest;
      var graphMembers = [];
      for (var k in compoundsMembers) {
        var componentArtifactId = compoundsMembers[k].componentId.substr(compoundsMembers[k].componentId.indexOf('/') + 1);
        manifest = this._manifestOfMember(compoundsMembers[k]);
        component = this._searchComponentInManifest(componentArtifactId, manifest);
        graphMember = this._generateGraphMember(component, compoundsMembers[k], manifest);
        graphMembers.push(graphMember);
      }
      return graphMembers;
    },

    /**
     * Generate a GraphMember (KNode) that represents a Component
     * @param {string} component - Component to be represented as GraphMember
     * @param {string} member - Member of a compoundComponent
     * @param {object} manifest - Manifest of the component
     * @param {object[]} [optionals] - Optional parameters
     * @returns {object} GraphMember (Knode)
     * @private
     */
    _generateGraphMember: function (component, member, manifest, optionals) {
      var memberId;
      if (member) {
        memberId = member.memberId;
      }
      var graphMemberSlots = this._generateGraphMemberSlots(component, memberId || component.artifactId);
      var webpackageQName = (manifest.groupId) ? manifest.groupId + '.' + manifest.name : manifest.name;
      var webpackageInfo = ':' + webpackageQName + '@' + manifest.version;
      var artifactId = '/' + component.artifactId;
      var header = this._generateComponentHeader(memberId, webpackageInfo, artifactId);

      var graphMember = {
        id: memberId || component.artifactId,
        labels: header.labels,
        width: Math.max(graphMemberSlots.slotsWidth + this.SLOT_LABELS_SPACE, header.width),
        height: graphMemberSlots.slotsHeight + header.height,
        ports: graphMemberSlots.slots,
        headerHeight: header.height,
        properties: {
          portConstraints: 'FIXED_SIDE',
          portLabelPlacement: (optionals) ? optionals.portLabelPlacement : 'INSIDE',
          nodeLabelPlacement: 'V_TOP H_CENTER',
          portAlignment: 'BEGIN',
          portSpacing: this.SLOT_SPACE,
          additionalPortSpace: 'top=' + (header.height + this.SLOTS_AREA_MARGIN * 1.5) +
          ', bottom=' + this.SLOTS_AREA_MARGIN + ',left=0,right=0',
          borderSpacing: (optionals) ? optionals.borderSpacing : 0
        }
      };
      return graphMember;
    },

    /**
     * Generate the labels array of the component header and calculate its width
     * @param memberId - Member id, if it is a member
     * @param webpackageInfo - :webpackageQName@version
     * @param artifactId - Artifact id of the component
     * @returns {{labels: *[], width: number}}
     * @private
     */
    _generateComponentHeader: function (memberId, webpackageInfo, artifactId) {
      var memberIdWidth = (memberId) ? memberId.length * this.COMPONENT_LABEL_LETTER_WIDTH : 0;
      var webpackageInfoWidth = webpackageInfo.length * this.COMPONENT_LABEL_LETTER_WIDTH * (memberId ? 0.85 : 1);
      var artifactIdWidth = artifactId.length * this.COMPONENT_LABEL_LETTER_WIDTH * (memberId ? 0.85 : 1);

      var memberIdHeight = (memberId) ? this.COMPONENT_LABEL_HEIGHT : 0;
      var webpackageInfoHeight = this.COMPONENT_LABEL_HEIGHT + this.HEADER_MARGIN * (memberId ? 3 : 0);
      var artifactIdHeight = this.COMPONENT_LABEL_HEIGHT * 0.8;

      var labels = [
        {
          text: memberId || '',
          width: memberIdWidth,
          height: memberIdHeight,
          className: 'memberIdLabel'
        },
        {
          text: webpackageInfo,
          width: webpackageInfoWidth,
          height: webpackageInfoHeight,
          className: memberId ? 'componentNameLabel' : 'componentNameRootLabel'
        },
        {
          text: artifactId,
          width: artifactIdWidth,
          height: artifactIdHeight,
          className: memberId ? 'componentNameLabel' : 'componentNameRootLabel'
        }
      ];

      return {
        labels: labels,
        width: Math.max(memberIdWidth, artifactIdWidth, webpackageInfoWidth),
        height: memberIdHeight + webpackageInfoHeight + artifactIdHeight + this.HEADER_MARGIN * 4
      };
    },

    /**
     * Generate the slots (ports) of a GraphMember (KNode)
     * @param {object} member - Component which is a member of a compound component
     * @param {string} memberId - memberId of the component within a compoundComponent
     * @returns {{slots: Array, slotsWidth: number}} - List of slots and the width of the widest slot
     * @private
     */
    _generateGraphMemberSlots: function (member, memberId) {
      var graphMemberSlots = [];
      var graphMemberSlot;
      var maxSlotWidthLeft = 0;
      var maxSlotWidthRight = 0;
      var inputSlots = 0;
      var outputSlots = 0;
      var slotLabelWidth;
      for (var l in member.slots) {
        for (var m in member.slots[l].direction) {
          slotLabelWidth = member.slots[l].slotId.length * this.SLOT_LABEL_LETTER_WIDTH;
          if (member.slots[l].direction[m] === 'input') {
            maxSlotWidthLeft = Math.max(slotLabelWidth, maxSlotWidthLeft);
            inputSlots++;
          } else {
            maxSlotWidthRight = Math.max(slotLabelWidth, maxSlotWidthRight);
            outputSlots++;
          }
          graphMemberSlot = this._generateGraphMemberSlot(member.slots[l], member.slots[l].direction[m], memberId);
          graphMemberSlots.push(graphMemberSlot);
        }
      }
      return {
        slots: graphMemberSlots,
        slotsWidth: maxSlotWidthLeft + maxSlotWidthRight,
        slotsHeight: Math.max(inputSlots, outputSlots) * (this.SLOT_DIAMETER + this.SLOT_SPACE) + this.SLOTS_AREA_MARGIN
      };
    },

    /**
     * Generate a slot (port) of a GraphMember (KNode)
     * @param {string} slot - Slot to be displayed
     * @param {string} memberId - memberId of the component within a compoundComponent
     * @param {string} direction - direction of the slot (input, output)
     * @returns {object} Generated slot (port)
     * @private
     */
    _generateGraphMemberSlot: function (slot, direction, memberId) {
      var graphMemberSlot = {
        id: slot.slotId + '_' + memberId + '_' + direction,
        properties: {
          portSide: (direction === 'input') ? 'WEST' : 'EAST',
          portAnchor: (direction === 'input') ? '(0.0, 0.5)' : '(0.0, 0.5)'
        },
        labels: [{
          text: slot.slotId,
          width: slot.slotId.length * this.SLOT_LABEL_LETTER_WIDTH,
          height: this.SLOT_LABEL_HEIGHT
        }],
        height: this.SLOT_DIAMETER,
        description: slot.description || '-',
        type: slot.type || 'any'
      };
      return graphMemberSlot;
    },

    /**
     * Generate the connections (edges) using a list of connections of a compound component
     * @param {Array} compoundConnections - List of connections of a compound component
     * @param {string} compoundId - artifactId of the compound component
     * @returns {Array} Generated connections
     * @private
     */
    _generateGraphConnections: function (compoundConnections, compoundId) {
      var connection;
      var connections = [];
      for (var n in compoundConnections) {
        connection = this._generateGraphConnection(compoundConnections[n], compoundId);
        connections.push(connection);
      }
      return connections;
    },

    /**
     * Generate a graph connection (edge) of a compound component
     * @param {object} compoundConnection - Connection within the compound component
     * @param {string} compoundId - artifactId of the compound component
     * @returns {object} Generated connection
     * @private
     */
    _generateGraphConnection: function (compoundConnection, compoundId) {
      var source;
      var sourcePort = compoundConnection.source.slot + '_';
      if (compoundConnection.source.memberIdRef) {
        source = compoundConnection.source.memberIdRef;
        sourcePort += compoundConnection.source.memberIdRef + '_' + 'output';
      } else {
        source = compoundId;
        sourcePort += compoundId + '_' + 'input';
      }
      var target;
      var targetPort = compoundConnection.destination.slot + '_';
      if (compoundConnection.destination.memberIdRef) {
        target = compoundConnection.destination.memberIdRef;
        targetPort += compoundConnection.destination.memberIdRef + '_' + 'input';
      } else {
        target = compoundId;
        targetPort += compoundId + '_' + 'output';
      }
      var connection = {
        id: compoundConnection.connectionId,
        labels: [{
          text: compoundConnection.connectionId,
          width: compoundConnection.connectionId.length * this.CONNECTION_LABEL_LETTER_WIDTH,
          height: this.CONNECTION_HEIGHT
        }],
        source: source,
        sourcePort: sourcePort,
        target: target,
        targetPort: targetPort
      };
      return connection;
    },

    /**
     * Returns the manifest of a member
     * @param {object} member - Member of a compound component
     * @returns {object} - Manifest of the component
     * @private
     */
    _manifestOfMember: function (member) {
      var manifest = {};
      if (member.componentId.indexOf('this/') !== -1) {
        return this.getManifest();
      } else {
        // TODO: Use method from CRC
        var manifestUrl = window.cubx.CRC._baseUrl + member.componentId.substr(0, member.componentId.indexOf('/'));
        // var manifestUrl = '../../' + member.componentId.substr(0, member.componentId.indexOf('/'));
        console.log(manifestUrl);
        $.ajaxSetup({async: false});
        $.getJSON(manifestUrl, function (response) {
          manifest = response;
        });
        $.ajaxSetup({async: true});
      }
      return manifest;
    },

    /**
     * Search a component in a determined manifest
     * @param {string} componentArtifactId - Artifact id of the component
     * @param {object} manifest - Manifest where the component will be searched
     * @returns {object} Found component
     * @private
     */
    _searchComponentInManifest: function (componentArtifactId, manifest) {
      if (!manifest.artifacts) {
        console.error('The manifest has no artifacts');
      }
      var componentDefinition = this._searchComponentInList(componentArtifactId, manifest.artifacts.elementaryComponents);
      if (!componentDefinition) {
        componentDefinition = this._searchComponentInList(componentArtifactId, manifest.artifacts.compoundComponents);
      }
      return componentDefinition;
    },

    /**
     * Search a component in a components list using its id
     * @param {string} componentId - Id of the component to be searched
     * @param {Array} componentsList - Array where the component will be searched
     * @returns {*}
     * @private
     */
    _searchComponentInList: function (componentId, componentsList) {
      for (var i in componentsList) {
        if (componentsList[i].artifactId === componentId) {
          return componentsList[i];
        }
      }
      return false;
    },

    /**
     * Center the component view horizontally and vertically and set and translate the zoom behavior to the center
     * @private
     */
    _centerDiagramAndSetZoomBehavior: function () {
      var componentViewHolderSvg = $('#' + this.VIEW_HOLDER_CSS_CLASS + '_svg');
      var componentViewHolderContainer = d3.select('#' + this.VIEW_HOLDER_CSS_CLASS + '_container');
      var newX = (componentViewHolderSvg.width() / 2) - (componentViewHolderContainer.node().getBBox().width / 2);
      var newY = (componentViewHolderSvg.height() / 2) - (componentViewHolderContainer.node().getBBox().height / 2);
      componentViewHolderContainer.transition()
        .attr('transform', 'translate(' + newX + ',' + newY + ')');

      var self = this;
      var zoom = d3.behavior.zoom()
        .translate([newX, newY])
        .on('zoom', function () {
          self.svg.attr('transform', 'translate(' + d3.event.translate + ')' + ' scale(' + d3.event.scale + ')');
        });
      d3.select('#' + this.VIEW_HOLDER_CSS_CLASS).call(zoom);
    },

    /**
     * Build and append all the graphic elements of a component described by a Kgraph
     * @param {object} componentGraph - JSON KGraph to be displayed
     * @private
     */
    _drawComponent: function (componentGraph) {
      // group
      d3.select('#' + this.VIEW_HOLDER_CSS_CLASS).html('');
      var self = this;
      if (!this.getViewerHeight()) {
        this.setViewerHeight(this.DEFAULT_VIEWER_HEIGHT);
      }
      this.svg = d3.select('#' + this.VIEW_HOLDER_CSS_CLASS)
        .append('svg')
        .attr('width', this.getViewerWidth())
        .attr('height', this.getViewerHeight())
        .attr('id', this.VIEW_HOLDER_CSS_CLASS + '_svg')
        .append('g')
        .attr('id', this.VIEW_HOLDER_CSS_CLASS + '_container');
      var realWidth = $('#' + this.VIEW_HOLDER_CSS_CLASS).width();
      var realHeight = $('#' + this.VIEW_HOLDER_CSS_CLASS).height();
      var root = this.svg.append('g');
      var layouter = klay.d3kgraph()
        .size([realWidth, realHeight])
        .transformGroup(root)
        .options({
          intCoordinates: true,
          edgeRouting: 'ORTHOGONAL',
          nodeLayering: 'LONGEST_PATH',
          nodePlace: 'BRANDES_KOEPF',
          crossMin: 'LAYER_SWEEP',
          algorithm: 'de.cau.cs.kieler.klay.layered'
        });
      layouter.on('finish', function (d) {
        var components = layouter.nodes();
        var connections = layouter.links(components);
        var componentsData = root.selectAll('.node')
          .data(components, function (d) { return d.id; });

        var connectionsData = root.selectAll('.link')
          .data(connections, function (d) { return d.id; });

        self._drawMembers(componentsData);
        self._drawConnections(connectionsData);
      });
      layouter.kgraph(componentGraph);
    },

    /**
     * Draw a square for each component and its id as label
     * @param {Object} componentsData - Data of each component (D3)
     * @private
     */
    _drawMembers: function (componentsData) {
      var self = this;
      var componentView = componentsData.enter()
        .append('g')
        .attr('id', function (d) {
          return d.id;
        })
        .attr('class', function (d) {
          if (d.children) {
            return 'componentView root ' + self.is;
          } else {
            return 'componentView member ' + self.is;
          }
        });

      var atoms = componentView.append('rect')
        .attr('class', function (d) {
          if (d.id !== 'root') {
            if (d.children) {
              return 'componentViewAtom root ' + self.is;
            } else {
              return 'componentViewAtom member ' + self.is;
            }
          } else {
            return '';
          }
        });

      var headingAtom = componentView.append('g')
        .attr('class', 'headingAtom ' + self.is);

      headingAtom.transition()
        .attr('width', function (d) { return d.width; })
        .attr('height', function (d) { return d.headerHeight; });

      var splitLine = componentView.append('line')
        .attr('class', 'splitLine ' + self.is);

      splitLine.transition()
        .attr('x1', 0)
        .attr('x2', function (d) { return d.width; })
        .attr('y1', function (d) { return d.headerHeight; })
        .attr('y2', function (d) { return d.headerHeight; });

      // Apply componentView positions
      componentView.transition()
        .attr('transform', function (d) {
          return 'translate(' + (d.x || 0) + ' ' + (d.y || 0) + ')';
        });

      atoms.transition()
        .attr('width', function (d) { return d.width; })
        .attr('height', function (d) { return d.height; })
        .each('end', function (d) {
          if (d.id === 'root') {
            self._centerDiagramAndSetZoomBehavior();
          }
        });

      // Nodes labels
      var componentViewLabel = headingAtom.selectAll('.componentViewHeaderLabel')
        .data(function (d) {
          return d.labels || [];
        })
        .enter()
        .append('text')
        .text(function (d) {
          return d.text;
        })
        .attr('class', function (d) {
          return 'componentViewHeaderLabel ' + d.className + ' ' + self.is;
        });

      componentViewLabel.transition()
        .attr('x', function (d, i, j) { return componentViewLabel[j].parentNode.__data__.width / 2; })
        .attr('y', function (d) { return d.y + d.height + self.HEADER_MARGIN; });

      this._drawComponentsSlots(componentsData);
    },

    /**
     * Draw the components' slots and their ids as labels
     * @param {Object} componentsData - Data of each component (D3)
     * @private
     */
    _drawComponentsSlots: function (componentsData) {
      var self = this;

      // slots
      var slotView = componentsData.selectAll('.slotView')
        .data(function (d) { return d.ports || []; })
        .enter()
        .append('g')
        .attr('id', function (d) {
          return d.id;
        })
        .attr('class', 'slotView ' + self.is);

      slotView.append('circle')
        .attr('class', 'slotViewAtom ' + self.is)
        .attr('r', self.SLOT_RADIUS)
        .attr('onmousemove', function (d) {
          return 'com_incowia_cubx_data_flow_viewer.showTooltip(' +
            'evt,' +
            '\"<label>Description:</label> ' + d.description + '<br>' +
            '<label>Type:</label> ' + d.type +
            '\")';
        })
        .attr('onmouseout', 'com_incowia_cubx_data_flow_viewer.hideTooltip()');

      // slots labels
      slotView.selectAll('.slotViewLabel')
        .data(function (d) { return d.labels; })
        .enter()
        .append('text')
        .text(function (d) { return d.text; })
        .attr('text-anchor', function (d) {
          return (d.x > 0) ? 'start' : 'end';
        })
        .attr('x', function (d) {
          return (d.x > 0) ? d.x + self.SLOT_RADIUS : -self.SLOT_DIAMETER;
        })
        .attr('y', function (d) {
          return Math.abs(d.height / 2 - self.SLOT_RADIUS / 2);
        })
        .attr('class', 'slotViewLabel ' + self.is);

      slotView.transition()
        .attr('transform', function (d) {
          return 'translate(' + (d.x || 0) + ' ' + (d.y || 0) + ')';
        });
    },

    /**
     * Draw the connections and their ids as labels
     * @param {Object} connectionData - Data of each connection (D3)
     * @private
     */
    _drawConnections: function (connectionData) {
      var self = this;
      // build the arrow.
      this.svg.append('svg:defs').selectAll('marker')
        .data(['end'])                 // define connectionView/path types
        .enter().append('svg:marker')    // add arrows
        .attr('id', String)
        .attr('class', 'arrowEnd ' + self.is)
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
        .attr('id', function (d) {
          return d.id;
        })
        .attr('class', 'connectionView ' + self.is)
        .attr('d', 'M0 0')
        .attr('marker-end', 'url(#end)');

      connectionData.enter()
        .append('text')
        .attr('class', 'connectionViewLabel ' + self.is)
        .attr('text-anchor', 'start')
        .attr('x', function (d) {
          return d.sourcePoint.x + self.CONNECTION_LABEL_MARGIN;
        })
        .attr('y', function (d) {
          return d.labels[0].y + d.labels[0].height * 2.5;
        })
        .text(function (d) {
          return d.labels[0].text || '';
        });

      // Apply connections routes
      connectionView.transition().attr('d', function (d) {
        var path = '';
        path += 'M' + (d.sourcePoint.x + self.SLOT_RADIUS) + ' ' + d.sourcePoint.y + ' ';
        (d.bendPoints || []).forEach(function (bp, i) {
          path += 'L' + bp.x + ' ' + bp.y + ' ';
        });
        path += 'L' + (d.targetPoint.x - self.SLOT_RADIUS) + ' ' + d.targetPoint.y + ' ';
        return path;
      });
    }
  });
}());
