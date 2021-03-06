/*
 * freepano - WebGL panorama viewer
 *
 * Copyright (c) 2014 FOXEL SA - http://foxel.ch
 * Please read <http://foxel.ch/license> for more information.
 *
 *
 * Author(s):
 *
 *      Luc Deschenaux <l.deschenaux@foxel.ch>
 *
 *
 * Contributor(s):
 *
 *      Alexandre Kraft <a.kraft@foxel.ch>
 *      Kevin Velickovic <k.velickovic@foxel.ch>
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

// class PanoList, to handle panorama.list
function PanoList(options) {
  if (!(this instanceof PanoList)) {
    return new PanoList(options);
  }
  $.extend(true,this,this.defaults,options);
  this.init();
}

$.extend(true,PanoList.prototype,{
  defaults: {
    texture: {
    },
    prefix: '',
    suffix: '',
    initialImage: null,
    callback: function panorama_callback(panorama_event) {
      switch(panorama_event.type) {
        default:
          console.log(panorama_event);
          break;
      }
    },
    overrided: null
  },

  init: function panoList_init(){
    var pano_list=this;
    var panorama=pano_list.panorama;

    // get initial image id
    if (!pano_list.initialImage) {
      for(property in pano_list.images) {
        if (pano_list.images.hasOwnProperty(property)) {
          pano_list.initialImage=property;
          break;
        }
      }
    }

    // initialize sphere options
    if (!panorama.sphere) {
      panorama.sphere={}
    }
    $.extend(true, panorama.sphere, {
        panorama: panorama,
        texture: {}
      }
    );

    // set initial sphere texture options
    if (pano_list.initialImage) {
      $.extend(true, panorama, pano_list.images[pano_list.initialImage], {
          sphere: {
            texture: pano_list.getTextureOptions(pano_list.initialImage)
          }
      });
      pano_list.overrideSettings(pano_list.initialImage);
    }

    pano_list.currentImage=pano_list.initialImage;
    pano_list.callback(); // fixme

  },

  // get panorama image options
  getTextureOptions: function panoList_getTextureOptions(imageId) {
    var pano_list=this;
    if (!pano_list.images || !pano_list.images[imageId]) {
      return {}
    }
    return $.extend(true, {},
      pano_list.defaults,
      pano_list.images[imageId], {
        baseName: pano_list.defaults.prefix+imageId+pano_list.defaults.suffix
      }
    );
  },

  // set panorama overrided settings
  overrideSettings: function panoList_overrideSettings(imageId) {

    var pano_list=this;

    // store current state
    if (pano_list.overrided===null) {
        pano_list.overrided = {
            lat: pano_list.panorama.lat,
            lon: pano_list.panorama.lon,
            rotation: pano_list.panorama.rotation,
            limits: pano_list.panorama.limits
        };
    }

    // override settings
    var override = pano_list.images[imageId].override;
    if (override===undefined || override===null)
        override = new Object();

    // rotation
    var rotation = $.extend(true,{},pano_list.overrided.rotation);
    if (override.rotation!==undefined) {
        // heading
        if (override.rotation.heading!==undefined) {
            pano_list.panorama.lon = pano_list.overrided.lon;
            rotation.heading = override.rotation.heading;
        }
        // tilt
        if (override.rotation.tilt!==undefined)
            rotation.tilt = override.rotation.tilt;
        // roll
        if (override.rotation.roll!==undefined)
            rotation.roll = override.rotation.roll;
    }
    pano_list.panorama.rotation = $.extend(true,{},rotation);

    // latitude
    var lat = pano_list.overrided.lat;
    if (override.lat!==undefined)
        lat = override.lat;
    pano_list.panorama.lat = lat;

    // limits
    var limits = pano_list.overrided.limits;
    if (override.limits!==undefined) {
        // latitude
        if (override.limits.lat!==undefined) {
            if (override.limits.lat.max!==undefined)
                limits.lat.max = override.limits.lat.max;
            if (override.limits.lat.min!==undefined)
                limits.lat.min = override.limits.lat.min;
        }
    }
    pano_list.panorama.limits = limits;

    // update rotation matrix
    pano_list.panorama.updateRotationMatrix();

  },

  // show panorama image
  show: function panoList_show(imageId,callback) {
    var pano_list=this;
    
    if (pano_list.currentImage==imageId || !pano_list.images[imageId]) {
      return;
    }

    var panorama=pano_list.panorama;

    // dont change panorama if callback return false
    if (panorama.callback({type: "dispose", target: panorama})===false) {
      return false;
    }

    pano_list.currentImage=imageId;
    $.extend(true, panorama, pano_list.images[imageId]);
    $.extend(true, panorama.sphere.texture, pano_list.getTextureOptions(imageId));
    pano_list.overrideSettings(imageId);
    panorama.sphere.updateTexture(callback);
  }

});

// patch Panorama.prototype to instantiate PanoList on init if required, then chain with panorama.init
$.extend(PanoList.prototype,{
    panorama_init: Panorama.prototype.init
});

$.extend(Panorama.prototype,{

  init: function panorama_init() {
    var panorama=this;
    if (panorama.list!==undefined) {
      if (!(panorama.list instanceof PanoList)) {
        panorama.list=new PanoList($.extend(true,{
          panorama: panorama,
          callback: function() {
            PanoList.prototype.panorama_init.call(panorama);
          }
        },panorama.list));
      }
    } else {
      PanoList.prototype.panorama_init.call(panorama);
    }
  }

});
