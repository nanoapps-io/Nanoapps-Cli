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
import $ from "jquery";

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
        verifyProjectToken()
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

function verifyProjectToken() {
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

function uploadBundleFile(project) {
    // let bundle_gen_cmd = 'node node_modules/react-native/local-cli/cli.js bundle --entry-file="index.android.js" --bundle-output="./main.jsbundle" --dev=false --platform="android"' 
    // if (shell.exec(bundle_gen_cmd).code !== 0) {
    //     shell.echo('Error: bundle file generation failed');
    //     shell.exit(1);
    //     return 
    // }
    let formData = new FormData();
    let bundleFile = fs.createReadStream("main.jsbundle")
    let nanoappsJson = fs.createReadStream("nanoapp.json")
    let data = new FormData();
    data.append('nanoapp', fs.createReadStream('./main.jsbundle'), 'main.js');
    data.append('nanoapp', fs.createReadStream('./nanoapp.json'), 'nanoapp.json');
    
    let options = {
        method: 'POST',
        url: 'http://localhost:8090/api/nanoapp/upload',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${data._boundary}`
        },
        data
    };
    
    return axios(options)
        .then(response => {
            console.log(response);
        });

}