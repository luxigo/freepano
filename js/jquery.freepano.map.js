/*
 * freepano - WebGL panorama viewer
 *
 * Copyright (c) 2014 FOXEL SA - http://foxel.ch
 * Please read <http://foxel.ch/license> for more information.
 *
 *
 * Author(s):
 *
 *      Kevin Velickovic <k.velickovic@foxel.ch>
 *
 *
 * Contributor(s):
 *
 *      Luc Deschenaux <l.deschenaux@foxel.ch>
 *      Alexandre Kraft <a.kraft@foxel.ch>
 *
 *
 * This file is part of the FOXEL project <http://foxel.ch>.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *
 * Additional Terms:
 *
 *      You are required to preserve legal notices and author attributions in
 *      that material or in the Appropriate Legal Notices displayed by works
 *      containing it.
 *
 *      You are required to attribute the work as explained in the "Usage and
 *      Attribution" section of <http://foxel.ch/license>.
 */

// Plugin constructor
function Map(options)
{
    if (!(this instanceof Map)) {
      return new Map(options);
    }

    // merge specified options with default options and extend this instance
    $.extend(true,this,Map.prototype.defaults,options);

    // Initialize plugin
    this.init();
}

// Extend plugin prototype
$.extend(true, Map.prototype, {

    // default values
    defaults: {
        // active
        active: false,

        // leaflet defaults
        leaflet: {

            // see http://leafletjs.com/reference.html#tilelayer-options
            tileLayer: {

                url_template: 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',

                options: {
                     attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                }

            },

            origin: [51.505, -0.09], // default geographical coordinates

            zoom: {
                base: 4,
                min: 3,
                max: 25,
                native: 18,
                bounds: 18
            },

            // see http://leafletjs.com/reference.html#map-zoompanoptions
            zoompan_options: undefined,

            icon: {
                iconUrl: 'img/marker_icon.png', // marker icon url
                shadowUrl: 'img/marker_shadow.png', // marker shadow image url
                iconSize: [22.5, 36.25], // marker size
                shadowSize: [40.75, 36.25], // marker shadow size
                iconAnchor: [22.5/2, 36.25], // point corresponding to marker's location
                shadowAnchor: [22.5/2, 36.25],
                popupAnchor: [0, 0] // point from which menu should popup relative to the iconAnchor
            },

            icon_highlighted: {
                iconUrl:     'img/marker_icon_highlight.png',
                shadowUrl:   'img/marker_shadow.png'
            }
        }
    },

    show: function map_show() {

        var map=this;

        // dom
        var pano = map.panorama;
        var container = $(pano.container);

        // map container exists ?
        var div=$('.map',container);
        if (div.length) {
            // then show map if hidden and/or return
            if (!$(div).is(':visible')) {
                div.show();
            }
            return;
        }

        // Append map
        var mapContainer = $('<div>',{'class':'map'});
        container.append(mapContainer);

        // Create leaflet map object
        var leaflet = map.leaflet.instance = L.map(mapContainer[0], {
            keyboard: false,
            scrollWheelZoom: true,
            minZoom: map.leaflet.zoom.min,
            maxZoom: map.leaflet.zoom.max
        }).setView(map.leaflet.origin, map.leaflet.zoom.base, map.leaflet.zoompan_options);

        // add a tile layer
        L.tileLayer(map.leaflet.tileLayer.url_template, $.extend(true,{},map.leaflet.tileLayer.options,{
            minZoom: map.leaflet.zoom.min,
            maxZoom: map.leaflet.zoom.max,
            maxNativeZoom: map.leaflet.zoom.native
        })).addTo(leaflet);

        // Create marker icon
        var markerIcon = L.icon(map.leaflet.icon);

        // Create highlighted marker icon
        var markerIcon_Highlighted = L.icon($.extend(true,{},map.leaflet.icon,map.leaflet.icon_highlighted));

        var markers = [];

        // Iterate over panoramas and create markers
        $.each(pano.list.images, function( index, image ) {

            // No geo coordinates
            if (image.coords === undefined || image.coords === null)
                return;

            // Icon
            var icon = markerIcon;

            // Use initial image if set and currentImage is not defined
            if (pano.list.currentImage === undefined && pano.list.initialImage !== undefined)
                pano.list.currentImage = pano.list.initialImage;

            // Use first image if currentImage is not defined
            else if (pano.list.currentImage === undefined)
                pano.list.currentImage = Object.keys(pano.list.images)[0];

            // Determine if the marker is highlighted
            if ( pano.list.currentImage == index )
                icon = markerIcon_Highlighted;

            // Create marker
            var marker = L.marker([image.coords.lat, image.coords.lon], {icon: icon})
            .on('click', function(e) {

                // Reset all markers to default icon
                $.each(markers, function( index, marker ) {
                    if (marker!==e.target)
                      marker.setIcon(markerIcon);
                });

                // Set highlighted icon for marker
                e.target.setIcon(markerIcon_Highlighted);

                // Check if panorama has changed, then change it
                var changed = e.target.panorama.index != pano.list.currentImage;
                if(changed)
                    pano.list.show(e.target.panorama.index);

                // Spread event
                $(map).trigger('markerclick',{changed:changed,target:e.target.panorama.index});

            });

            // Extend marker with panorama object
            $.extend( marker, {
                panorama: {
                    index: index,
                    image: image
                }
            });

            // Add marker to array
            markers.push( marker )

            // Add marker to map
            marker.addTo(leaflet)

        });

        // No elligible markers
        if (markers.length == 0) {
            this.hide();
            return;
        }

        // Create makers featureGroup
        var markersGroup = new L.featureGroup(markers);

        // Fit map to markers
        leaflet.fitBounds(markersGroup.getBounds());

        // Unzoom from bounds
        if (leaflet.getZoom() > map.leaflet.zoom.bounds)
            leaflet.setZoom(map.leaflet.zoom.bounds);
        else
            leaflet.setZoom(leaflet.getZoom()-1);

    }, // map_show

    hide: function map_hide() {
        $('.map',this.panorama.container).hide();
    },

    remove: function map_remove() {
        $('.map',this.panorama.container).remove();
    },

    init: function map_init() {
        var map = this;

        // watch touch move properties
        watch(map,['active'], function() {
            if (map.active)
                map.show();
            else
                map.hide();
        });

        map.callback({target: map, type: 'ready'});

    }, // map_init

    callback: function map_callback(e) {
        var map=e.target;
        switch(e.type){
            case 'ready':
                // chain with old panorama.prototype.init on callback
                map.panorama_init.call(map.panorama);
                break;
        }
    } // map_callback

});

// register freepano.map plugin

$.extend(Map.prototype,{
    // save pointers to overrided Panorama.prototype methods 
    panorama_init: Panorama.prototype.init,
    panorama_callback: Panorama.prototype.callback
});

$.extend(Panorama.prototype,{

  // hook Map.prototype.init to Panorama.prototype.init
  init: function map_panorama_init() {

    var panorama=this;

    // skip Map instantiation if map preferences undefined in panorama
    if (panorama.map!==undefined) {

      // or if map is already instantiated
      if (!(panorama.map instanceof Map)) {

        // instantiate map
        panorama.map=new Map($.extend(true,{

          // pass panorama instance pointer to map instance
          panorama: panorama,

        },panorama.map));

      }

    } else {

      // chain with old panorama.prototype.init
      Map.prototype.panorama_init.call(panorama);

    }
  }, // map_panorama_init

  // hook to Panorama.prototype.callback
  callback: function map_panorama_callback(panorama_event) {
    var panorama=this;
    var map=panorama.map;

    if (map!=undefined) {
      switch(panorama_event.type){

        // show map on pano ready
        case 'ready':
          if (map.active) {
            map.show();
          } else {
            map.hide();
          }
          break;

      } // switch panorama_event.type
    }

    // chain with previous panorama callback
    Map.prototype.panorama_callback.apply(panorama,[panorama_event]);

  } // map_panorama_callback

});

