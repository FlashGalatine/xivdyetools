// Cloudflare execute template; __CONFIG__ is populated from the saved inventory for each batch.
async () => {
  const config = __CONFIG__;
  const protectedByProject = {"xivdyetools":"970e253a-083a-4d97-bdb2-8e8e2792dee4","xivdyetools-beta":"5a3fb28b-2091-47e7-a6b3-2495c5a52090"};
  const domainsByProject = {"xivdyetools":["xiv-colorexplorer.pages.dev","xivdyetools.app"],"xivdyetools-beta":["xivdyetools-beta.pages.dev","beta.xivdyetools.app"]};
  if (!Object.hasOwn(protectedByProject, config.project)) throw Error('Unexpected project');
  const protectedId = protectedByProject[config.project];
  const live = await cloudflare.request({method:'GET', path:'/accounts/'+accountId+'/pages/projects/'+config.project});
  const project = live.result;
  if (!live.success || project.canonical_deployment?.id !== protectedId || project.latest_deployment?.id !== protectedId) throw Error('Active deployment changed; stop and re-inventory');
  if (JSON.stringify([...project.domains].sort()) !== JSON.stringify([...domainsByProject[config.project]].sort())) throw Error('Project domains changed');
  if (!Array.isArray(config.candidates) || config.candidates.length > 25) throw Error('Invalid batch');
  for (const row of config.candidates) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.id) || row.id === protectedId) throw Error('Protected or invalid deployment in batch');
    if (row.aliases.some(alias => domainsByProject[config.project].some(domain => alias === 'https://'+domain))) throw Error('Candidate owns a live project domain');
  }
  const results = [];
  for (const row of config.candidates) {
    try {
      const response = await cloudflare.request({method:'DELETE',path:'/accounts/'+accountId+'/pages/projects/'+config.project+'/deployments/'+row.id,query:{force:row.environment==='preview' && row.aliases.length>0}});
      results.push({id:row.id,status:response.status,success:response.success,errors:response.errors});
      if (!response.success) break;
    } catch (error) {results.push({id:row.id,error:String(error)});break;}
  }
  return {project:config.project,protected_id:protectedId,performed_at:new Date().toISOString(),results};
}
