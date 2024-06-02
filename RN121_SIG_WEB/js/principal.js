// Objeto mapa
var mapa = L.map("mapaid", {
  center: [9.89, -84.19],
  zoom: 13,
});

// Capa base de OSM
osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 25,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(mapa);

// Capa base de ESRI World Imagery
esriworld = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  }
);

// Capas base
var mapasbase = {
  "ESRI World Imagery": esriworld,
  "Open Street Map": osm,
};
// Control de capas
control_capas = L.control
  .layers(mapasbase, null, { collapsed: false })
  .addTo(mapa);

// Control de escala
L.control.scale().addTo(mapa);

// Capa vectorial de cuencas en formato GeoJSON
$.getJSON("datos/cuencas.geojson", function (geodata) {
  var capa_cuencas = L.geoJson(geodata, {
    style: function (feature) {
      return { color: "green", weight: 2.5, fillOpacity: 0.0 };
    },
    onEachFeature: function (feature, layer) {
      var popupText =
        "<strong>Id</strong>: " +
        feature.properties.id_cuencas +
        "<br>" +
        "<strong>Área</strong>: " +
        feature.properties.area +
        " m²" +
        "<br>" +
        "<strong>Distrito</strong>: " +
        feature.properties.distrito;
      layer.bindPopup(popupText);
    },
  }).addTo(mapa);

  control_capas.addOverlay(capa_cuencas, "Cuencas");
});

// Capa vectorial de líneas en formato GeoJSON
$.getJSON("datos/tuberias.geojson", function (geodata) {
  var capa_tuberias = L.geoJson(geodata, {
    style: function (feature) {
      return { color: "red", weight: 5, fillOpacity: 0.0 };
    },
    onEachFeature: function (feature, layer) {
      var popupText =
        "<strong>Id</strong>: " +
        feature.properties.id_tuberia +
        "<br>" +
        "<strong>Longitud</strong>: " +
        feature.properties.longitud +
        " m" +
        "<br>" +
        "<strong>Estado</strong>: " +
        feature.properties.estado +
        "<br>" +
        "<strong>Diámetro</strong>: " +
        feature.properties.diametro +
        " m";
      layer.bindPopup(popupText);
    },
  }).addTo(mapa);

  control_capas.addOverlay(capa_tuberias, "Tuberías");
});

// Capa raster de elevaciones
var url_to_geotiff_file = "datos/dem.tif";

fetch(url_to_geotiff_file)
  .then((response) => response.arrayBuffer())
  .then((arrayBuffer) => {
    parseGeoraster(arrayBuffer).then((georaster) => {
      console.log("georaster:", georaster);

      var layer = new GeoRasterLayer({
        georaster: georaster,
        opacity: 0.5,
        pixelValuesToColorFn: function (value) {
          if (value <= 0) {
            return "rgba(255, 255, 255, 0.0";
          } else if (value < 884) {
            return "#66CCFF";
          } else if (value < 890) {
            return "#6666FF";
          } else if (value < 896) {
            return "#330099";
          } else {
            return "#330033";
          }
        },
        resolution: 1024, // optional parameter for adjusting display resolution
      });
      layer.addTo(mapa);

      // Capa raster en control de capas
      control_capas.addOverlay(layer, "Elevaciones");

      // Evento onClick
      mapa.on("click", function (event) {
        console.log(event, "event");

        var lat = event.latlng.lat;
        var lng = event.latlng.lng;
        var tmp = geoblaze.identify(georaster, [lng, lat]);

        // Borrar marcadores previos
        mapa.eachLayer(function (layer) {
          if (layer instanceof L.Marker) {
            mapa.removeLayer(layer);
          }
        });

        // Marcador con ventana popup
        var marcador = L.marker([lat, lng])
          .addTo(mapa)
          .bindPopup("Elevación: " + Math.round(tmp, 1) + " m")
          .openPopup();
      });
    });
  });

// Capa de coropletas sobre pendiente promedio de cuencas
$.getJSON("datos/cuencas.geojson", function (geojson) {
  var capa_cuencas_coropletas = L.choropleth(geojson, {
    valueProperty: "pendiente",
    scale: ["green", "yellow", "orange", "brown"],
    steps: 5,
    mode: "q",
    style: {
      color: "#fff",
      weight: 2,
      fillOpacity: 0.7,
    },
    onEachFeature: function (feature, layer) {
      layer.bindPopup(
        "Id: " +
          feature.properties.id_cuencas +
          "<br>" +
          "Pendiente: " +
          feature.properties.pendiente.toLocaleString() +
          "%"
      );
    },
  }).addTo(mapa);
  control_capas.addOverlay(
    capa_cuencas_coropletas,
    "Pendiente promedio de cuencas (%)"
  );

  // Leyenda de la capa de coropletas
  var leyenda = L.control({ position: "bottomleft" });
  leyenda.onAdd = function (map) {
    var div = L.DomUtil.create("div", "info legend");
    var limits = capa_cuencas_coropletas.options.limits;
    var colors = capa_cuencas_coropletas.options.colors;
    var labels = [];

    // Add min & max
    div.innerHTML =
      '<div class="labels"><div class="min">' +
      limits[0] +
      '</div> \
        <div class="max">' +
      limits[limits.length - 1] +
      "</div></div>";

    limits.forEach(function (limit, index) {
      labels.push('<li style="background-color: ' + colors[index] + '"></li>');
    });

    div.innerHTML += "<ul>" + labels.join("") + "</ul>";
    return div;
  };
  leyenda.addTo(mapa);
});
