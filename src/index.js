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
        uploadBundleFile()
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
                    persistToken(response['data'])
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
                    uploadBundleFile(response['data']['project'])
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    } catch (err) {
        console.log(err)
    }
}

function uploadBundleFile() {
    // let bundle_gen_cmd = 'node node_modules/react-native/local-cli/cli.js bundle --entry-file="index.android.js" --bundle-output="./main.jsbundle" --dev=false --platform="android"' 
    // if (shell.exec(bundle_gen_cmd).code !== 0) {
    //     shell.echo('Error: bundle file generation failed');
    //     shell.exit(1);
    //     return 
    // }
    let file = homedir() + configs.NANOAPPS_FOLDER + configs.CREDS_FILE
    let credsFile = jsonfile.readFileSync(file)
    let authToken = credsFile["token"]
    let formData = new FormData();
    let nanoappsJson = jsonfile.readFileSync("./nanoapp.json")
    let data = new FormData();
    data.append('project_token',nanoappsJson['project_token'])
    data.append('name',nanoappsJson['name'])
    data.append('package_name',nanoappsJson['package_name'])
    data.append('version_code',nanoappsJson['version_code'])
    data.append('version_name',nanoappsJson['version_name'])
    data.append('description',nanoappsJson['description'])
    data.append('bundle_file', fs.createReadStream('./main.jsbundle'), 'main.js');
    data.append('app_icon', fs.createReadStream(nanoappsJson['app_icon']), nanoappsJson['app_icon']);
    let options = {
        method: 'POST',
        url: 'http://localhost:8090/api/nanoapp/upload',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
            'X-Nanoapp-Token': 'Bearer ' + authToken
        },
        data
    };
    return axios(options)
        .then(response => {
            console.log(response.data);
        }).catch(function (error) {
            console.log(error);
        });
}

function validateNanoappsJsonFile(json) {
    console.log("Validation nanoapps json file")
}