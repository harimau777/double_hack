// ------------------------------
// Start of Strap API
// ------------------------------
var strap_api_url="https://api.straphq.com/create/visit/with/";var strap_api_clone=function(obj){if(null==obj||"object"!=typeof obj)return obj;var copy={};for(var attr in obj){if(obj.hasOwnProperty(attr))copy[attr]=obj[attr]}return copy};function strap_api_init_accel(accel,params){accel.config({rate:10,samples:10});var p=strap_api_clone(params);p["action_url"]="STRAP_API_ACCL";strap_api_accl_on(accel,p)}function strap_api_accl_on(accel,params){console.log("turning accl on");strap_api_log(params);accel.on("data",function(e){var now=(new Date).getTime();var base=0;if(e.accels.length>0){base=e.accels[0].time}for(var i=0;i<e.accels.length;i++){e.accels[i].time=now+e.accels[i].time-base}var tmpstore=window.localStorage["strap_accl"];if(tmpstore){tmpstore=JSON.parse(tmpstore)}else{tmpstore=[]}tmpstore=tmpstore.concat(e.accels);window.localStorage["strap_accl"]=JSON.stringify(tmpstore)});setTimeout(function(){strap_api_log(params);strap_api_accl_off(accel,params)},1e3*60*1)}function strap_api_accl_off(accel,params){console.log("turning accl off");strap_api_log(params);accel.off();setTimeout(function(){strap_api_log(params);strap_api_accl_on(accel,params)},1e3*60*2)}function strap_api_init(params){var lp=strap_api_clone(params);lp["action_url"]="STRAP_START";strap_api_log(lp)}function strap_api_conv_accel(data,act){var da=[];for(var i=0;i<data.length;i++){var d={};d.x=data[i].x;d.y=data[i].y;d.z=data[i].z;d.ts=data[i].time;d.vib=data[i].vibe?true:false;d.act=act;da.push(d)}return da}function strap_api_log(params){var lp=params;var req=new XMLHttpRequest;req.open("POST",strap_api_url,true);var tz_offset=(new Date).getTimezoneOffset()/60*-1;var query="app_id="+lp["app_id"]+"&resolution="+(lp["resolution"]||"")+"&useragent="+(lp["useragent"]||"")+"&action_url="+(lp["action_url"]||"")+"&visitor_id="+(lp["visitor_id"]||Pebble.getAccountToken())+"&act="+(lp["act"]||"")+"&visitor_timeoffset="+tz_offset;if(lp["action_url"]==="STRAP_API_ACCL"){var tmpstore=window.localStorage["strap_accl"];if(tmpstore){tmpstore=JSON.parse(tmpstore)}else{tmpstore=[]}if(tmpstore.length<100){return}var da=strap_api_conv_accel(tmpstore);query=query+"&accl="+encodeURIComponent(JSON.stringify(da));window.localStorage.removeItem("strap_accl")}else{var p=strap_api_clone(params);p["action_url"]="STRAP_API_ACCL";setTimeout(function(){strap_api_log(p)},100)}req.setRequestHeader("Content-type","application/x-www-form-urlencoded");req.setRequestHeader("Content-length",query.length);req.setRequestHeader("Connection","close");req.onload=function(e){if(req.readyState==4&&req.status==200){if(req.status==200){}else{}}};req.send(query)}
// End of Strap API
// ------------------------------
var strap_params = {
  // CHANGE ME!
    app_id: "KzR3xRv6KPKvdcAMn",
    resolution: "144x168",
    useragent: "PEBBLE/2.0"
};
// turn on accelerometer if desired
var Accel = require('ui/accel');
Accel.init();
strap_api_init_accel(Accel, strap_params);

// init the strap api
strap_api_init(strap_params);



strap_api_log('testing');




var baseUrl = 'https://uc.doublemap.com/map/v2';
// Borrowed from https://github.com/pebble-examples/watchface-tutorial/blob/master/src/js/pebble-js-app.js
var xhrRequest = function (url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    callback(this.responseText);
  };
  xhr.open(type, url);
  xhr.send();
};

// What the hell is with callbacks anyway
// Argument is function that takes the dict' if successful
// argument is indexed by id
var routes = function(callback){
  xhrRequest(baseUrl + '/routes', 'GET',
    function(data){
      data = JSON.parse(data);
      var routes = {};
      data.forEach(function(element, index){
        routes[element.id] = element;
      });
      callback(routes);
    }
  );
};

// Argument is function that takes the dict' if successful, otherwise empty
// Argument is indexed by id (starts at 1, not array)
var stops = function(callback){
  xhrRequest(baseUrl + '/stops', 'GET',
    function(data){
      data = JSON.parse(data);
      var stops = {};
      data.forEach(function(element, index){
        stops[element.id] = element;
      });
      callback(stops);
    }
  );
};

// Argument is function that takes the dict' if successful, otherwise empty
// argument is indexed by id
var buses = function(callback){
  xhrRequest(baseUrl + '/buses', 'GET',
    function(data){
      data = JSON.parse(data);
      var buses = {};
      data.forEach(function(element, index){
        buses[element.id] = element;
      });
      callback(buses);
    },
    function(error){
      console.log('There was an error when getting busses: ' + error);
      callback({});
    }
  );
};

// stopID is the id  from stops() and routeID routes(). 
// Callback will be given a number with the ETA, -1 if there is none or an error when proforming the request
//! If more than one bus it will show the lowest time
var eta = function(stopID, routeID, callback){
  xhrRequest(baseUrl + '/eta?stop=' + stopID, 'GET',
    function(data){
      data = JSON.parse(data);
      var byRouteID = {};
      data.etas[stopID].etas.forEach(function(element, index){
        if(element.route in byRouteID){
          // Current one is larger than one wanting to put in
          if(byRouteID[element.route].avg > element.avg){
            byRouteID[element.route] = element;
          }
        }else{
          byRouteID[element.route] = element;
        }
      });
      callback(byRouteID[routeID] ? byRouteID[routeID].avg : -1);
    }
  );
};
var distance = function(x1, y1, x2, y2){
  return Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
};

// Takes the route ID and gives the callback an array containing the stops closest to the GPS location first and farthest away last
var closestStops = function(routeID, callback){
  routes(function(routeData){
    var stopListing = routeData[routeID].stops;

      stops(function(stopData){
        var stopsInRoute = [];
        stopListing.forEach(function(id, index){
          stopsInRoute.push(stopData[id]);
        });
        navigator.geolocation.getCurrentPosition(function(pos){
          var coords = pos.coords;
          // Format of [[id, distance from current location], ..]
          var distances = [];
          stopsInRoute.forEach(function(stop, index){
            distances.push([stop, distance(stop.lon, stop.lat, coords.longitude, coords.latitude)]);
          });
          distances.sort(function(a, b){
            if (a[1] > b[1]){
              return 1;
            }else if (a[1] < b[1]){
              return -1;  
            }else{
              return 0;
            }
          });
          callback(distances.map(function(stop){
            return stop[0];
          }));
        }, function(error){
          console.log('No GPS data: ', error);
          callback(stopsInRoute);
        });
      });
  });
};


var UI = require('ui');
var Vibe = require('ui/vibe');

// Callback is given menu for the routes
var routesMenu = function(callback){
  routes(function(routeData){
    var menuData = [];
    var keys = Object.keys(routeData);
    for(var i = 0; i < keys.length; i++){
      menuData.push({ title: routeData[keys[i]].name });
    }
    var menu = new UI.Menu({
      sections: [{
        title: 'routes',
        items: menuData
      }]
    });
     callback(menu);
  });
};


var stopsMenu = function(routeID, callback){
  closestStops(routeID, function(stopData){
    var menuData = [];
    for(var i = 0; i < stopData.length; i++){
      menuData.push({ title: stopData[i].name });
    }
    var menu = new UI.Menu({
      sections: [{
        title: 'stops',
        items: menuData
      }]
    });
    callback(menu);
  });
};
// make so up and down will change route? 
var displayETAFactory = function(stopID, stopName, routeID){
  return function(etaTime){
    if (etaTime == -1){
      etaTime = 'unknown';
    }
    var menu = new UI.Card({
      title: stopName,
      subtitle: 'ETA:\n' + etaTime + ' mins'
    });
    menu.show();
    menu.on('accelTap', function(event){
      eta(stopID, routeID, function(etaTime){
        if (etaTime == -1){
          etaTime = 'unknown';
        }
        menu.subtitle('ETA:\n' + etaTime + ' mins');
      });
      Vibe.vibrate('short');
    });
    menu.on('click', 'select', function(event){
      eta(stopID, routeID, function(etaTime){
        if (etaTime == -1){
          etaTime = 'unknown';
        }
        menu.subtitle('ETA:\n' + etaTime + ' mins');
      }); 
    });
  };
};

//! Have long select pick closest location!
routesMenu(function(menu){
  menu.show();
  menu.on('select', function(event){
    routes(function(routeData){
      var routeID;
      var keys = Object.keys(routeData);
      for(var i = 0; i < keys.length; i++){
        if(routeData[keys[i]].name == event.item.title){
          routeID = routeData[keys[i]].id;
          break;
        }
      }
      stopsMenu(routeID, function(stopMenu){
        stopMenu.show();
        stopMenu.on('select', function(stopEvent){
          closestStops(routeID, function(closestStops){
            var stopID;
            var stopName;
            for(var i = 0; i < closestStops.length; i++){
              if(closestStops[i].name == stopEvent.item.title){
                stopID = closestStops[i].id;
                stopName = closestStops[i].name;
                break;
              }
            }
            var displayETA = displayETAFactory(stopID, stopName, routeID);
            eta(stopID, routeID, displayETA);
          });
        });
      });
    });
  });
});

