/*
 * freepano - WebGL panorama viewer
 *
 * Copyright (c) 2015 FOXEL SA - http://foxel.ch
 * Please read <http://foxel.ch/license> for more information.
 *
 *
 * Author(s):
 *
 *      Luc Deschenaux <l.deschenaux@foxel.ch>
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

function PointCloud(options) {
  if (!(this instanceof PointCloud)) {
    return new PointCloud(options);
  }
  $.extend(true,this,{},this.defaults,options);
  this.init();
}

$.extend(true,PointCloud.prototype,{

  defaults: {

    enableParticleEvents: true,

    showParticleCursor: true,

    overlay: true,

    // paramaeters for converting panorama url to pointcloud json url
    urlReplace: {
      replaceThis: new RegExp(/\/pyramid\/.*/),
      replaceWithThis: '/pointcloud/',
      suffix: [ '.json' ]
    },
/*
    // point cloud dot material
    dotMaterial: new THREE.PointCloudMaterial({
        map: THREE.ImageUtils.loadTexture('img/dot.png'),
        size: 0.15,
        color: 'yellow',
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
        alphaTest: 0.1,
        depthTest: false,
        depthWrite: false
    }), // pointCloud.defaults.dotMaterial
  */ 
   // generate particle positions array from json 
    parseJSON: function parseJSON(json) {

      var pointCloud=this;
      var panorama=pointCloud.panorama;

      var positions = new Float32Array(json.points.length * 3);

      var v=new THREE.Vector3();

      // create empty sections
      var section=pointCloud.section=[];
      for(var x=0; x<360; ++x) {
        section[x]=[];
        for(var y=0; y<180; ++y) {
          section[x][y]=[];
        }
      }
      var step=Math.PI/180;

      var i=0;

      switch(pointCloud.urlReplace.suffix[pointCloud.type]) {
        case '.json':

          var field_count=json.points_format.length;
          console.log('parsing cloud... ('+(json.points.length/field_count)+' points)');
          
          // set pointcloud field offset
          pointCloud.offset={};
          $.each(json.points_format,function(i,value){
            pointCloud.offset[value]=i;
          });
          var offset=pointCloud.offset;

          var halfov=panorama.camera.instance.fov/2;
          var aspect=panorama.camera.instance.aspect;

          var fov={
            theta: {
               min: (panorama.lon-halfov*aspect)*Math.PI/180+Math.PI,
               max: (panorama.lon+halfov*aspect)*Math.PI/180+Math.PI
            },
            phi: {
               min: ((panorama.lat+90-halfov))*Math.PI/180,
               max: ((panorama.lat+90+halfov))*Math.PI/180              
            }
          }

          function _clamp(value,max) {
            if (value<0) return value+max;
            if (value>max) return value-max;
            return value;
          }

          fov.theta.min=_clamp(fov.theta.min,Math.PI*2);
          fov.theta.max=_clamp(fov.theta.max,Math.PI*2);
          fov.phi.min=_clamp(fov.phi.min,Math.PI)-Math.PI/2;
          fov.phi.max=_clamp(fov.phi.max,Math.PI)-Math.PI/2;
          
          var points=json.points;
          for (var k=0; k<json.points.length; k+=field_count) {

            var phi=points[k+offset.phi];
            var theta=points[k+offset.theta];
            var depth=points[k+offset.depth];

            if (
                  (
                    (theta>fov.theta.min && theta<fov.theta.max) ||
                    ((fov.theta.max<fov.theta.min) && theta<fov.theta.max && theta>fov.theta.min)
                  
                  ) && (

                    (phi>fov.phi.min && phi<fov.phi.max) ||
                    ((fov.phi.max<fov.phi.min) && phi<fov.phi.max && phi>fov.phi.min)
                  )
            ) {

              // unit vector
              v.x=0;
              v.y=0;
              v.z=1;

              // apply rotations
              v.applyAxisAngle(panorama.Xaxis,phi);
              v.applyAxisAngle(panorama.Yaxis,theta);

              // store position
              positions[i]=-v.x*depth;
              positions[i+1]=v.y*depth;
              positions[i+2]=v.z*depth;
              i+=3;

            }

            // store particle index where it belongs
            var x=Math.round(theta/step)%360;
            var y=Math.round(phi/step);

            if (y<0) {
              y+=180;
            }

//            try {
              section[x][y].push(k/field_count);
/*            } catch(e) {
              console.log(x,y);
            }
*/
          }
          break;

      }
      console.log('parsing cloud... done');

      return positions.subarray(0,i);

    }, // pointCloud.defaults.parseJSON

    // sort point cloud particles by depth
    sortParticles: false,

    // raycaster options
    raycaster: {
      threshold: 0.5 
    }

  }, // pointCloud.prototype.defaults

  init: function pointCloud_init(){
    var pointCloud=this;

    if (pointCloud.overlay) {
      pointCloud.scene=new THREE.Scene();
    }

    // init raycaster
    if (!(pointCloud.raycaster instanceof THREE.Raycaster)) {
      if (pointCloud.raycaster && pointCloud.raycaster.instance) {
        delete pointCloud.raycaster.instance;
      }
      pointCloud.raycaster.instance=new THREE.Raycaster(pointCloud.raycaster.options);
      pointCloud.raycaster.instance.params.PointCloud.threshold=pointCloud.raycaster.threshold||0.01;
    }

    // load url if any
    if (pointCloud.url) {
      pointCloud.fromURL(pointCloud.url);

    // load json if any
    } else if (pointCloud.json) {
      pointCloud.fromJSON(pointCloud.json);
    }

    // trigger pointCloud 'init' event
    pointCloud.dispatch('init');

  }, // pointCloud_init

  // load point cloud json from url
  fromURL: function pointCloud_fromURL(url) {

    var pointCloud=this;
    pointCloud.url=url;

    $.ajax({

      url: pointCloud.url,

      error: function() {
        // trigger pointcloud 'loaderror' event
        pointCloud.dispatch('loaderror',Array.prototype.slice.call(arguments));
      }, // error

      success: function(json){

        // no data available ?
        if (!json.points) {
          // trigger pointcloud 'loaderror' event
          pointCloud.dispatch('loaderror',Array.prototype.slice.call(arguments));
          return;
        }

        // parse point cloud json
        pointCloud.fromJSON(json);

        // trigger pointcloud 'load' event
        pointCloud.dispatch('load');

      } // success

    });  // ajax
    
  }, // pointCloud_fromURL

  // load point cloud from json
  fromJSON: function pointCloud_fromJSON(json){

    var pointCloud=this;

    // keep json reference
    pointCloud.json=json;

    // instantiate point cloud geometry
    pointCloud.geometry=new THREE.BufferGeometry();
    
    // extract particles positions from JSON 
    var positions=pointCloud.parseJSON(json);
    
    // add particles to geometry
    pointCloud.geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3)); 
    
    // instantiate object3D 
    pointCloud.object3D=new THREE.PointCloud(pointCloud.geometry,pointCloud.dotMaterial);
    pointCloud.object3D.sortParticles=pointCloud.sortParticles;

  }, // pointCloud_fromJSON

  // pointcloud 'load' event handler
  onload: function pointCloud_onload(e) {

    var pointCloud=this;
    var panorama=pointCloud.panorama;

    // add pointcloud to scene
    var scene=(pointCloud.overlay)?pointCloud.scene:panorama.scene;
    scene.add(pointCloud.object3D);

    pointCloud.dispatch('ready');

    panorama.drawScene();
  
  }, // pointCloud_onload

  // pointcloud 'loaderror' event handler
  onloaderror: function pointCloud_onloaderror(e) {
    console.log(e);
  }, // onloaderror

  // render pointcloud overlay on "panorama render" event
  on_panorama_render: function pointCloud_on_panorama_render(){

    var panorama=this;
    if (!panorama.pointCloud) {
      return;
    }

    var pointCloud=panorama.pointCloud.instance;
    if (!pointCloud) {
      return;
    }

    var cursor=pointCloud.cursor;
    if (cursor) {
      var scale=0.1/p.getZoom();
      cursor.sprite.scale.set(scale,scale,scale);
    }

    if (pointCloud.overlay) {
      panorama.renderer.clearDepth();
      panorama.renderer.render(pointCloud.scene,panorama.camera.instance);  
    }

    pointCloud.dispatch('render');

  }, // on_panorama_render

  // trigger pointcloud 'particlemouseover' event on particle mouseover
  on_panorama_mousemove: function pointCloud_on_panorama_mousemove(e){

    var panorama=this;
    var pointCloud=panorama.pointCloud;

    if (!pointCloud.instance || !pointCloud.instance.enableParticleEvents) {
      return;
    }

    if (
      !pointCloud ||
      !pointCloud.instance ||
      pointCloud.active===false ||
      !pointCloud.instance.object3D ||
      !pointCloud.instance.object3D.visible
    ) {
      return;
    }

    // compute mouse normalized coordinates
    var canvas=panorama.renderer.domElement;
    var offset=$(canvas).offset();
    var mouse={
      x: ((e.clientX-offset.left) / canvas.width) * 2 - 1,
      y: -((e.clientY-offset.top) / canvas.height) * 2 + 1
    }

/*
    // setup raycaster
    var raycaster=pointCloud.instance.raycaster;
    raycaster.instance.setFromCamera(mouse,panorama.camera.instance);

    // get intersection list
    var intersections=raycaster.instance.intersectObject(pointCloud.instance.object3D);

*/

    panorama.getMouseCoords(e);
    var lon=Math.round(panorama.mouseCoords.lon)-180;
    var lat=-Math.round(panorama.mouseCoords.lat);
    if (lat<0) lat+=180;
    if (lon<0) lon+=360;
    var intersections=pointCloud.instance.section[lon][lat];
    // trigger pointcloud mouseover event
    if (intersections.length) {
      pointCloud.instance.dispatch({
          type: 'particlemouseover',
          target: intersections,
          originalEvent: e
      });
    } else {
      if (pointCloud.instance.hover){
        pointCloud.instance.dispatch({
            type: 'particlemouseout',
            target: pointCloud.instance.hover.index,
            originalEvent: e
        });
      }
    }

  }, // pointCloud_on_panorama_render

  // snap to nearest intersecting particle
  onparticlemouseover: function on_pointcloud_particlemouseover(e){

    var pointCloud=this;
    var panorama=pointCloud.panorama;

    var particle_indexList=e.target;

    // get nearest point index
    panorama.getMouseCoords(e.originalEvent);
    var hover={index: pointCloud.nearestParticle(panorama.mouseCoords,particle_indexList)};

    // if we were already hovering
    if (pointCloud.hover) {

      // and it was another point
      if (hover.index != pointCloud.hover.index){
        // then trigger 'particlemouseout'
        var e={
            type: 'particlemouseout',
            target: pointCloud.hover.index
        }
        // unless event handler doesnt agree to remove hover attribute
        if (pointCloud.dispatch(e)===false) {
          return false;
        }
      } else {
        // already hovering the same point, return
        return 
      }
    }

    // mousein
    pointCloud.hover=hover;

    var material;
    var cursor=pointCloud.cursor;

    // instantiate cursor if needed
    if (!cursor) {
      cursor=pointCloud.cursor={
        material: new THREE.SpriteMaterial({
          map: THREE.ImageUtils.loadTexture('img/dot_hover.png'),
          depthTest: false,
          depthWrite: false
        }),
        geometry: new THREE.Geometry()
      }
      cursor.sprite=new THREE.Sprite(cursor.material);
      pointCloud.scene.add(cursor.sprite);
    }

    cursor.sprite.visible=pointCloud.showParticleCursor;
      
    cursor.sprite.position.copy(new THREE.Vector3().copy(pointCloud.getParticlePosition(hover.index)).normalize().multiplyScalar(10));

    pointCloud.panorama.drawScene();

    pointCloud.dispatch({
        type: 'particlemousein',
        target: hover.index
    });

  }, // pointCloud_particleonmouseover

  onparticlemousein: function pointCloud_onparticlemousein(e) {
    var pointCloud=this;
    if (pointCloud.showDebugInfo) {
      pointCloud.showParticleInfo(pointCloud.hover.index);
    }
  }, // pointCloud_onparticlemousein

  onparticlemouseout: function pointCloud_onparticlemouseout(e) {
    var pointCloud=this;
    if (pointCloud.hideDebugInfo) {
      pointCloud.hideParticleInfo();
    }
  }, // pointCloud_onparticlemousein

  // return particle with least square distance from coords in radians
  nearestParticle: function pointCloud_nearestParticle(coords,particle_indexList) {
    var pointCloud=this;
    var panorama=pointCloud.panorama;
    var candidate=0;
    var d2min=999;
    var point_list=pointCloud.json.points;
    var offset=pointCloud.offset;
  
    $.each(particle_indexList,function(i,index){

      index*=pointCloud.json.points_format.length;

      // compute absolute angle difference
      var dthe=Math.abs(point_list[index+offset.theta]-panorama.mouseCoords.theta);
      var dphi=Math.abs(point_list[index+offset.phi]+panorama.mouseCoords.phi);

      // adjust delta when crossing boundaries
      // (assume distance is less than half image)
      if (dthe>Math.PI) dthe=Math.PI*2-dthe;
      if (dphi>Math.PI/2) dphi=Math.PI-dphi;

      // select least square distance
      var dsquare=dthe*dthe+dphi*dphi;
      if (dsquare<d2min) {
        d2min=dsquare;
        candidate=i;

      // select nearest point depth when equidistant from cursor
      } else if (dsquare==d2min) {
        if (point_list[candidate*pointCloud.json.points_format.length+offset.depth]>point_list[index+offset.depth]) {
          candidate=i;
        }
      }

    });

    return particle_indexList[candidate];

  }, // pointCloud_nearestParticle

  // return spherical particle world coordinates
  getParticleSphericalCoords: function pointCloud_getParticleSphericalCoords(index) {
    var pointCloud=this;
    var points=pointCloud.json.points;
    var offset=pointCloud.offset;
    index*=pointCloud.json.points_format.length;
    return {
      lon: points[index+offset.theta]*180/Math.PI-180,
      lat: -points[index+offset.phi]*180/Math.PI,
      radius: points[index+offset.depth]
    }
  }, // pointCloud_getParticleSphericalCoords

  // return cartesian particle world coordinates
  getParticlePosition: function pointCloud_getParticlePosition(index) {
    var pointCloud=this;
    var panorama=pointCloud.panorama;
    var points=pointCloud.json.points;
    var offset=pointCloud.offset;

    index*=pointCloud.json.points_format.length;
  
    // initialize vector
    var v=new THREE.Vector3(0,0,1);

    // apply rotations
    v.applyAxisAngle(panorama.Xaxis,points[index+offset.phi]);
    v.applyAxisAngle(panorama.Yaxis,points[index+offset.theta]);

    // return position
    var depth=points[index+offset.depth];
    return {
      x: -v.x*depth,
      y: v.y*depth,
      z: v.z*depth
    }
  }, // pointCloud_getParticlePosition

  showParticleInfo: function pointCloud_showParticleInfo(index) {
 
    var pointCloud=this;
    var points=pointCloud.json.points;
    var panorama=pointCloud.panorama;
    var offset=pointCloud.offset;
    index*=pointCloud.json.points_format.length;
  
    var div = $('#info');
    if (!div.length) {

        // create #info div 
        div = $('<div id="info"><div id="particle"></div></div>')

        div.appendTo(panorama.container).css({
            position: 'absolute',
            top: 10,
            left: 10,
            width: 128,
            padding: 10,
            backgroundColor: "rgba(0,0,0,.4)",
            color: 'white'
        });

    }

    // particle info
    if (points[index+offset.theta]==undefined) {
      return;
    }
    var html = '<div style="width: 100%; position: relative; margin-left: 10px;">'
    + '<b>Particle info:</b><br />'
//    + 'theta: ' + points[index+offset.theta].toPrecision(6) + '<br />'
//    + 'phi: ' + points[index+offset.phi].toPrecision(6) + '<br />'
    + 'distance: ' + points[index+offset.depth].toPrecision(6) + '<br />'
    + 'index: ' + points[index+offset.index] + '<br />';
  
    $('#particle',div).html(html);
  
    // trigger pointcloud_updateinfo
    var e={
      type: 'showParticleInfo',
      div: div
    }
    pointCloud.dispatch(e);

    div.show(0);

  }, // pointCloud_showParticleInfo

  hideParticleInfo: function pointCloud_hideParticleInfo(){
    $('#particleInfo').hide(0);
  }, // pointCloud_hideParticleInfo

  // dispatch particle click on panorama click
  on_panorama_click: function pointCloud_on_panorama_click(e) {
    var panorama=this;
    var pointCloud=panorama.pointCloud.instance;

    // only when a particle is hovered by mouse
    if (!pointCloud || !pointCloud.hover) {
      return;
    }

    pointCloud.dispatch({
        type: 'particleclick',
        target: pointCloud.hover.index,
        originalEvent: e
    });

  }, // pointCloud_on_panorama_click

  // instantiate point cloud on panorama_ready
  on_panorama_ready: function pointCloud_on_panorama_ready(e) {

    var panorama=this;

    // only if the pointcloud is defined and active
    if (panorama.pointCloud && panorama.pointCloud.active!==false) {

      // get panorama to pointcloud url conversion parameters
      var urlReplace=panorama.pointCloud.urlReplace||PointCloud.prototype.defaults.urlReplace;
      var replaceThis=urlReplace.replaceThis;
      var replaceWithThis=urlReplace.replaceWithThis;
      
      // validate every possible URL according to urlReplace.suffix[] and use the first available one

      var validatedURL=[];
      var numRepliesExpected=urlReplace.suffix.length;

      // ajax HEAD callback 
      var callback=function pointcloud_ajax_head_callback(result,url,i) {

        validatedURL[i]=(result=='success')?url:null;

        // last ajax reply expected ?
        --numRepliesExpected;
        if (!numRepliesExpected) {

          // use the first URL available
          $.each(validatedURL,function(type){

            if (validatedURL[type]) {

              // instantiate pointcloud
              var pointCloud=panorama.pointCloud.instance=new PointCloud($.extend(true,{},panorama.pointCloud,{
                    panorama: panorama,
                    url: validatedURL[type],
                    type: type 
              }));

              // exit loop
              return false;

            }

          });
        } 
      } // pointcloud_ajax_head_callback


      // validate urls
      $.each(urlReplace.suffix,function(i,suffix){
      
        var pointcloud_json_url=panorama.sphere.texture.dirName.replace(replaceThis,replaceWithThis)+p.list.currentImage+suffix;

        // javascript loop closure 
        (function(pointcloud_json_url,i,callback){

          // validate url
          $.ajax({
            url: pointcloud_json_url,
            type:'HEAD',
            error: function() {
              callback('error');

            },
            success: function() {
              callback('success',pointcloud_json_url,i);
            }
          });

        })(pointcloud_json_url,i,callback);
      });

    }

  }, // pointCloud_on_panorama_ready

  // dispose pointcloud on panorama dispose
  on_panorama_dispose: function pointCloud_on_panorama_dispose(e) {
    var panorama=this;
    if (panorama.pointCloud && panorama.pointCloud.instance) {
      
      // remove pointcloud from scene
      var scene=(panorama.pointCloud.instance.overlay)?panorama.pointCloud.instance.scene:panorama.scene;
      scene.remove(panorama.pointCloud.instance.object3D);

      // delete object
      delete panorama.pointCloud.instance;
    }
  } // pointCloud_on_panorama_dispose

});

setupEventDispatcher(PointCloud.prototype);

// subscribe to panorama events
Panorama.prototype.dispatchEventsTo(PointCloud.prototype);
