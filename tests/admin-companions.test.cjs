const assert=require('node:assert/strict'),{connection,normalName}=require('../server/admin-companion-alerts');
for(const value of ["SAM'S FAMILY","SAM'S FRIEND","GROOM'S JSS MATE","Samuel’s colleague",'Invited by Sam'])assert.equal(connection(value),'sam');
for(const value of ["JOSSY'S FAMILY","JOSSY'S FRIEND","BRIDE'S JSS MATE",'Josephine’s cousin','Invited by Jossy'])assert.equal(connection(value),'jossy');
for(const value of ['','OTHER','OPASS','KOSEC','COLLEAGUE','CHURCH FAMILY',"LET'S VIBE",'Sam and Jossy','bride & groom','Samantha','sampler','Not Sam','I don’t know Jossy'])assert.equal(connection(value),null,'Do not guess '+value);
assert.equal(normalName('  Jane   DOE '),'jane doe');
console.log('PASS explicit Sam/Jossy relation routing, ambiguous/unknown exclusions and exact name normalisation');
