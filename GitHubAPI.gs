const SPREADSHEET_ID = '18zq30X4XjbpNxr5CQWvyoYirGPFRzqv1Ur_blpxQ';

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'all';
    let result;
    if (action === 'board') result = {ok:true, board:getBoardData_(ss)};
    else if (action === 'notifications') result = {ok:true, notifications:getNotifications_(ss)};
    else result = {ok:true, board:getBoardData_(ss), notifications:getNotifications_(ss)};
    return json_(result);
  } catch (error) {
    return json_({ok:false,error:error.message,stack:error.stack});
  }
}

function getBoardData_(ss) {
  const sheetNames=['JPCB A','JPCB B'];
  const allUnits=[]; const allColumns=[];
  sheetNames.forEach(sheetName=>{
    const sheet=ss.getSheetByName(sheetName); if(!sheet)return;
    const lastRow=sheet.getLastRow(), lastColumn=sheet.getLastColumn();
    if(lastRow<3||lastColumn<7)return;
    const values=sheet.getRange(1,1,lastRow,lastColumn).getDisplayValues();
    const timelineStart=7;
    for(let c=timelineStart-1;c<lastColumn;c++){
      const date=clean_(values[1]&&values[1][c]); const time=clean_(values[2]&&values[2][c]);
      if(date||time)allColumns.push({source:sheetName,sourceColumn:c+1,date,time});
    }
    for(let r=3;r<lastRow;r++){
      const row=values[r]||[];
      const identity=clean_(row[0]),tglIn=clean_(row[1]),jamIn=clean_(row[2]),tgtOut=clean_(row[3]),jamOut=clean_(row[4]),actualProcess=clean_(row[5]);
      const timeline=row.slice(timelineStart-1).map(clean_);
      const hasTimeline=timeline.some(v=>v!=='');
      if(!identity&&!tglIn&&!jamIn&&!tgtOut&&!jamOut&&!actualProcess&&!hasTimeline)continue;
      allUnits.push({source:sheetName,row:r+1,identity,tglIn,jamIn,tgtOut,jamOut,actualProcess,timeline});
    }
  });
  return {columns:allColumns,units:allUnits};
}
function getNotifications_(ss){
  const sheet=ss.getSheetByName('NOTIFIKASI'); if(!sheet)return[];
  const lr=sheet.getLastRow(),lc=sheet.getLastColumn(); if(lr<1||lc<1)return[];
  const values=sheet.getRange(1,1,lr,lc).getDisplayValues();
  const headers=values[0].map(clean_); const out=[];
  for(let r=1;r<values.length;r++){
    const item={}; headers.forEach((h,c)=>{if(h)item[h]=clean_(values[r][c])});
    if(Object.values(item).some(v=>v!==''))out.push(item);
  }
  return out;
}
function clean_(v){return v==null?'':String(v).replace(/^"+|"+$/g,'').trim()}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)}
