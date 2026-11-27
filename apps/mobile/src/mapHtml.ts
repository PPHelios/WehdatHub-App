/** The page the Map tab shows inside a WebView: Leaflet draws the self-hosted .pmtiles map, the app sends the pins. */
export type MapPinColors = { pin: string; onPin: string; selected: string; onSelected: string; canvas?: string; dark?: boolean };
export function mapHtml(tilesUrl: string, lang: 'ar' | 'en', c: MapPinColors = { pin: '#0F3F34', onPin: '#fff', selected: '#082921', onSelected: '#fff' }): string {
  const tiles = JSON.stringify(tilesUrl).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#m{height:100%;margin:0;background:${c.canvas ?? '#E7EEF6'}}
.leaflet-top .leaflet-control{margin-top:70px}
.pin{background:${c.pin};color:${c.onPin};border:1px solid rgba(255,255,255,.44);border-radius:999px;font:700 12px sans-serif;display:flex;align-items:center;min-height:34px;gap:5px;padding:0 10px;width:max-content;max-width:164px;direction:${lang === 'ar' ? 'rtl' : 'ltr'};transform:translate(-50%,-50%);box-shadow:0 4px 12px rgba(8,41,33,.28)}
.pin-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pin-count{flex:none}
.pin.sel{background:${c.selected};color:${c.onSelected};border-color:#6EE7B7;box-shadow:0 5px 15px rgba(8,41,33,.44)}
.leaflet-marker-icon:focus-visible .pin{outline:2px solid #34D399;outline-offset:2px}
</style>
</head><body><div id="m"></div>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js"></script>
<script>
(function(){
  var post=function(o){window.ReactNativeWebView.postMessage(JSON.stringify(o));};
  var map=L.map('m',{zoomControl:true,attributionControl:false,minZoom:5,maxZoom:17}).setView([30.05,31.45],9);
  protomapsL.leafletLayer({url:${tiles},flavor:'${c.dark ? 'dark' : 'light'}',lang:'${lang}'}).addTo(map);
  var layer=L.layerGroup().addTo(map);var fitted=false;
  window.setPins=function(pins,selId){
    layer.clearLayers();
    var pts=[];
    pins.forEach(function(p){
      var name=('${lang}'==='ar'?p.name_ar:p.name_en)||p.name;
      var pin=document.createElement('div');pin.className='pin'+(p.id===selId?' sel':'');
      var label=document.createElement('span');label.className='pin-name';label.textContent=name;
      var count=document.createElement('span');count.className='pin-count';count.textContent='('+p.n+')';
      pin.append(label,count);
      var icon=L.divIcon({className:'',html:pin,iconSize:[0,0],iconAnchor:[0,0]});
      L.marker([p.lat,p.lng],{icon:icon,title:name+' ('+p.n+')',zIndexOffset:p.id===selId?1000:0}).on('click',function(){post({type:'pin',id:p.id,name:name});}).addTo(layer);
      pts.push([p.lat,p.lng]);
    });
    if(pts.length&&!fitted){fitted=true;map.fitBounds(pts,{padding:[40,40],maxZoom:13});}
  };
  window.flyTo=function(lat,lng,z){map.flyTo([lat,lng],z||14,{duration:0.8});};
  post({type:'ready'});
})();
</script></body></html>`;
}
