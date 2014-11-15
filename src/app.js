
var baseUrl = 'https://uc.doublemap.com/map/v2';

// What the hell is with callbacks anyway
// Argument is function that takes the dict' if successful, otherwise empty
// argument is indexed by id
var routes = function(callback){
  ajax(
    {
      url: baseUrl + '/routes',
      type: 'json'
    },
    function(data){
      var routes = {};
      data.forEach(function(element, index){
        routes[element.id] = element;
      });
      callback(routes);
    },
    function(error){
      console.log('There was an error when getting routes: ' + error);
      callback({});
    }
  );
};

// Argument is function that takes the dict' if successful, otherwise empty
// Argument is indexed by id (starts at 1, not array)
var stops = function(callback){
  ajax(
    {
      url: baseUrl + '/stops',
      type: 'json'
    },
    function(data){
      var stops = {};
      data.forEach(function(element, index){
        stops[element.id] = element;
      });
      callback(stops);
    },
    function(error){
      console.log('There was an error when getting stops: ' + error);
      callback({});
    }
  );
};

// Argument is function that takes the dict' if successful, otherwise empty
// argument is indexed by id
var buses = function(callback){
  ajax({
    url: baseUrl + '/buses',
    type: 'json'
    },
    function(data){
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
  ajax({
    url: baseUrl + '/eta?stop=' + stopID,
    type: 'json'
  },
    function(data){
      data.etas[stopID].etas.forEach(function(element, index){
        if (element.route == routeID){
          callback(element.avg);
        }
      });
      callback(-1);
  },
    function(error){
      console.log('There was an error when getting the eta: ', error);
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

closestStops(37, function(data){
  var textData = data.map(function(item){return item.name;}).join('\n');
  console.log(textData);
  simply.text({ title: 'stops', body: textData });
});