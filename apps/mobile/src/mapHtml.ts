/** The page the Map tab shows inside a WebView: Leaflet draws the self-hosted .pmtiles map, the app sends the pins. */
export type MapPinColors = { pin: string; onPin: string; selected: string; onSelected: string };
/** Colours come from the app theme: pin = royal (accent), selected = gold (brand). */
export function mapHtml(tilesUrl: string, lang: 'ar' | 'en', c: MapPinColors = { pin: '#122b4f', onPin: '#fff', selected: '#c29741', onSelected: '#122b4f' }): string {
  const tiles = JSON.stringify(tilesUrl);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#m{height:100%;margin:0}.pin{background:${c.pin};color:${c.onPin};border:2px solid #fff;border-radius:999px;font:700 13px sans-serif;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4)}.pin.sel{background:${c.selected};color:${c.onSelected}}</style>
</head><body><div id="m"></div>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js"></script>
<script>
(function(){
  var post=function(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));};
  var map=L.map('m',{zoomControl:true,attributionControl:false,minZoom:5,maxZoom:17}).setView([30.05,31.45],9);
  protomapsL.leafletLayer({url:${tiles},flavor:'light',lang:'${lang}'}).addTo(map);
  var layer=L.layerGroup().addTo(map);var fitted=false;var last=[];var selId=null;
  window.setSelected=function(id){selId=id;window.setPins(last);};
  window.setPins=function(pins){
    last=pins;
    layer.clearLayers();
    var pts=[];
    pins.forEach(function(p){
      var size=p.n>99?44:p.n>9?38:32;
      var icon=L.divIcon({className:'',html:'<div class="pin'+(p.id===selId?' sel':'')+'" style="width:'+size+'px;height:'+size+'px">'+p.n+'</div>',iconSize:[size,size]});
      L.marker([p.lat,p.lng],{icon:icon}).on('click',function(){post({type:'pin',id:p.id,name:p.name});}).addTo(layer);
      pts.push([p.lat,p.lng]);
    });
    if(pts.length&&!fitted){fitted=true;map.fitBounds(pts,{padding:[40,40],maxZoom:13});}
  };
  window.flyTo=function(lat,lng,z){map.flyTo([lat,lng],z||14,{duration:0.8});};
  post({type:'ready'});
})();
</script></body></html>`;
}
