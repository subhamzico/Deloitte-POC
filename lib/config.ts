import cdk = require ('@aws-cdk/core')
export class Configuration{

getConfig(app:cdk.App){
    let env = app.node.tryGetContext('config')
    if (!env)
    {
        throw new Error("Missing Variable")
    }
    let unparsedEnv = app.node.tryGetContext(env)
    let  buildconfig = {
        Stage: this.ensureString(unparsedEnv,'Stage'),
        AWSAccountID : this.ensureString(unparsedEnv,'AWSAccountID'),
        Region: this.ensureString(unparsedEnv,'Region'),
        Env : this.ensureString(unparsedEnv,'Env'),
        RoleArn: this.ensureString(unparsedEnv,'RoleArn'),
    }
    return buildconfig
}
ensureString(object:Array<String>, propname?:any){
    if(!object[propname] || object[propname].trim().length==0)
    {
        throw new Error("Does not Exist");
    }
    return object[propname]
}


}