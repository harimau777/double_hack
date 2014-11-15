
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
//! TODO test working when a bus is actually running
var eta = function(stopID, routeID, callback){
  xhrRequest(baseUrl + '/eta?stop=' + stopID, 'GET',
    function(data){
      data = JSON.parse(data);
      data.etas[stopID].etas.forEach(function(element, index){
        if (element.route == routeID){
          callback(element.avg);
        }
      });
      callback(-1); 
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

// Assumes all valus are not negative currently
Pebble.addEventListener('appmessage',
      // Event data
      //
      // 0: function -> [routes, stops, eta]
      // 1: routeID (-1 if none)
      // 2: step ID (-1 if none)
      //! Send value to identify which choice it is
      //! Do these functions even work from the C side? 
      function(event){
        switch(event.payload[0]){
          case 0:
            routes(function(routes){
              Pebble.sendAppMessage(routes.map(function(element){ return element.name; }), function(working){}, function(failure){});
            });
            break;
          case 1:
            stops(function(stops){
              routes(function(routes){
                var stopsOnRoute = routes[event.payload[1]].stops;
                var result = {};
                stopsOnRoute.forEach(function(stopID, index){
                  result[stopID] = stops[stopID].name;
                });
                Pebble.sendAppMessage(result, function(working){}, function(failure){});
              });
            });
            break;
          case 2:
            eta(event.payload[2], event.payload[1], function(eta){
              Pebble.sendAppMessage(eta, function(working){}, function(failure){});
            });
        }
});

// Testing
closestStops(37, function(data){
  console.log(data);
  var textData = data.map(function(item){return item.name;}).join('\n');
  console.log(textData);
});
