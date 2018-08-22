var express = require('express')
var app = express()
const config = require(`./config.json`);
const snek = require("snekfetch");
const ora = require('ora');
console.log(`Starting Pi-Hole for LaMetric ${config.version}...`)
let spinner = ora(`Testing Pi-Hole Connection @ ${config.PiHole.IP}...`).start();

snek.get(`http://${config.PiHole.IP}/admin/api.php?getQueryTypes&auth=${config.PiHole.AuthKey}`).then(PiHoleResult => {
    spinner.succeed(`Pi-Hole Connection @ ${config.PiHole.IP} Successful!`)
    spinner = ora(`Testing Pi-Hole Auth...`).start();
    if (PiHoleResult.body.querytypes != null) {
        spinner.succeed(`Pi-Hole Auth Valid!`)
        let successfulLaMetricConnections = 0;
        let LaMetricTest = (indexNumber) => {
            if (config.LaMetric[indexNumber] != null) {
                spinner = ora(`Testing Connection to LaMetric @ ${config.LaMetric[indexNumber].IP}...`).start();
                snek.get(`http://${config.LaMetric[indexNumber].IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`).set('Authorization', `Basic ${Buffer.from(`dev:${config.LaMetric[indexNumber].AuthKey}`).toString('base64')}`).then(LaMetricDeviceInfo => {
                    successfulLaMetricConnections++;
                    snek.get(`http://${config.LaMetric[indexNumber].IP}:8080/api/v2/device`).set('Authorization', `Basic ${Buffer.from(`dev:${config.LaMetric[indexNumber].AuthKey}`).toString('base64')}`).then(LaMetricDeviceInfo2 => {
                        spinner.succeed(`Connected to "${LaMetricDeviceInfo2.body.name}" @ ${config.LaMetric[indexNumber].IP} running OS version ${LaMetricDeviceInfo2.body.os_version}! (${LaMetricDeviceInfo2.body.serial_number})`)
                    })
                }).catch(err => {
                    if (config.debugMode) {
                        console.log(err)
                    }
                    if (err.statusCode != null && err.body.errors != null) {
                        if (err.statusCode == 401) {
                            spinner.fail(`Connection to LaMetric @ ${config.LaMetric[indexNumber].IP} Failed. Auth invalid.`);
                        } else if (err.statusCode == 404) {
                            spinner.fail(`Connection to LaMetric @ ${config.LaMetric[indexNumber].IP} Failed. Pi-Hole Status app not installed on the LaMetric.`);
                        } else {
                            spinner.fail(`Connection to LaMetric @ ${config.LaMetric[indexNumber].IP} Failed. LaMetric does not seem to linked to this IP.`);
                        }
                    } else {
                        spinner.fail(`Connection to LaMetric @ ${config.LaMetric[indexNumber].IP} Failed. LaMetric does not seem to linked to this IP.`);
                    }
                    LaMetricTest(indexNumber + 1);
                })
            } else {
                if (successfulLaMetricConnections > 0) {

                } else {
                    console.log(`At least 1 LaMetric must have a successful connection to continue.`)
                    process.exit()
                }
            }
        }
        LaMetricTest(0)
    } else {
        spinner.fail("Pi-Hole Auth Invalid! Make sure the supplied key is correct.");
        process.exit()
    }
}).catch(err => {
    if (config.debugMode) {
        console.log(err)
    }
    spinner.fail("Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct.");
    process.exit()
})
