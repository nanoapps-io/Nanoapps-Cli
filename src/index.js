#!/usr/bin/env node

import prompt from "prompt"
import homedir from "homedir"
import * as configs from "./config"
import fs from "fs"
import jsonfile from "jsonfile"
import axios from "axios"
import program from "commander"
import shell from "shelljs"
import FormData from "form-data"
import child_process from 'child_process'
import md5File from 'md5-file'

program
    .command('login')
    .description('Login to nanoapps console')
    .action(() => {
        console.log("Enter your email and password")
        Login()
    });

program
    .command('create')
    .description('Create nanoapps')
    .action(() => {
        CompilandUploadBundleFile()
    });

program
    .command('update')
    .description('update nanoapps')
    .action(() => {
        CompilandUploadBundleFile()
    });    

program.parse(process.argv);

function Login() {
    prompt.start()
    let properties = [
        {
            name: 'Email'
        }, {
            name: 'Password',
            hidden: true
        }
    ]
    prompt.get(properties, (err, result) => {
        if (err) {
            return onErr(err);
        }
        let data = {
            email: result.Email,
            password: result.Password
        }
        axios
            .post(configs.API_URL + "/developer/login", data)
            .then(function (response) {
                if (response['data'].status == "success") {
                    console.log("Login successfull")
                    persistToken(response['data'])
                } else {
                    console.log("Login failed")
                    console.log(response['data'].message)
                }
            })
            .catch(function (error) {
                console.log(error);
            });

    })
}

function onErr(err) {
    console.log(err)
    return 1;
}

function checkAvailableFiles() {
}


function persistToken(response) {
    let dir = homedir() + configs.NANOAPPS_FOLDER
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
    }
    jsonfile.writeFileSync(dir + configs.CREDS_FILE, response)
}

function getProjectToken() {
    // let file = homedir() + configs.NANOAPPS_FOLDER + configs.CREDS_FILE
    let file = homedir() + configs.NANOAPPS_FOLDER + configs.CREDS_FILE
    let credsFile = jsonfile.readFileSync(file)
    let authToken = credsFile["token"]
    let packageJsonFile = jsonfile.readFileSync("package.json")
    let nanoappSettings = packageJsonFile["nanoapp"]
    let data = {
        "project_token": nanoappSettings["project_token"]
    }
    let headers = {
        'Content-Type': 'application/json',
        'X-Nanoapp-Token': 'Bearer ' + authToken
    }
    try {
        axios
            .post(configs.API_URL + "/project/verify_token", data, {'headers': headers})
            .then(function (response) {
                if (response['data'].status == "success") {
                    //uploadBundleFile(response['data']['project'])
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    } catch (err) {
        console.log(err)
    }
}

function getIndexComponent(indexFileContent) {
    let regex = /AppRegistry\.registerComponent\([\'\"](\w+)[\'\"]/g
    let group = regex.exec(indexFileContent)
    return group[1]
}

function CompilandUploadBundleFile() {
    let indexFile = ""
    if (fs.existsSync("index.js")) {
        indexFile = "index.js"
    } else if (fs.existsSync("index.android.js")) {
        indexFile = "index.android.js"
    }
    if(!indexFile) {
        console.log("index.js or index.android.js does not exist")
        return
    }
    
    let file = homedir() + configs.NANOAPPS_FOLDER + configs.CREDS_FILE
    let credsFile = jsonfile.readFileSync(file)
    let authToken = credsFile["token"]
    let formData = new FormData();
    let nanoappsJson = jsonfile.readFileSync("./nanoapp.json")
    
    if (!fs.existsSync("./nanoapp.json")) {
        console.log("nanoapp.json does not exist")
        return
    }

    let bundleFile = fs.readFileSync(indexFile, 'utf8')
    let bundle_gen_cmd = 'node node_modules/react-native/local-cli/cli.js bundle --entry-file="'+indexFile+'" --bundle-output="./main.jsbundle" --dev=false --platform="android"' 
    let code = child_process.execSync(bundle_gen_cmd, {stdio:[0,1,2]})
    let indexComponent = getIndexComponent(bundleFile)
    if (code != null) {
        console.log('Error: bundle file generation failed');
        return 
    }

    let data = new FormData();
    data.append('project_token',nanoappsJson['project_token'])
    data.append('name',nanoappsJson['name'])
    data.append('package_name',nanoappsJson['package_name'])
    data.append('version_code',nanoappsJson['version_code'])
    data.append('version_name',nanoappsJson['version_name'])
    data.append('description',nanoappsJson['description'])
    data.append('main_component_name', indexComponent)
    data.append('checksum', md5File.sync('./main.jsbundle'))
    data.append('bundle_file', fs.createReadStream('./main.jsbundle'), 'main.js');
    if(nanoappsJson['app_icon'] == null) {
        console.log("Please provide an icon for the app");
    }
    
    data.append('app_icon', fs.createReadStream(nanoappsJson['app_icon']), nanoappsJson['app_icon']);
    let options = {
        method: 'POST',
        url: configs.API_URL+'/nanoapp/upload',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
            'X-Nanoapp-Token': 'Bearer ' + authToken
        },
        data
    };
    return axios(options)
        .then(response => {
            if(response.data['status'] == 'success') {
                console.log("nanoapp successfully created")
            } else if(response.data['status'] == 'success') {
                console.log("Creating nanoapp failed. Please try again later")
            }
        }).catch(function (error) {
            console.log("Error Occurred. Please try again later")
        });
}
