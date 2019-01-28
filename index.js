var express = require('express')
var app = express()
const config = require(`./config.json`);
const snek = require("snekfetch");
const ora = require('ora');
console.log(`Starting Pi-Hole for LaMetric ${config.version}...`)
let spinner = ora(`Testing Pi-Hole Connection @ ${config.PiHole.IP}...`).start();
let availableLaMetrics = [];

if (config.debugMode) {
    console.log("Debug Mode Enabled")
}

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
                        spinner.succeed(`Connected to "${LaMetricDeviceInfo2.body.name}" @ ${config.LaMetric[indexNumber].IP} running OS v${LaMetricDeviceInfo2.body.os_version} & Pi-Hole Status v${LaMetricDeviceInfo.body.version}! (${LaMetricDeviceInfo2.body.serial_number})`)
                        availableLaMetrics.push(config.LaMetric[indexNumber]);
                        LaMetricTest(indexNumber + 1);
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
                    spinner = ora(`Checking for updates...`).start();
                    snek.get(`https://raw.githubusercontent.com/iDerp/Pi-Hole-for-LaMetric/stable/example.config.json`).then(updateCheckResult => {
                        if (JSON.parse(updateCheckResult.body).version == config.version) {
                            spinner.info('Up to date.')
                        } else {
                            spinner.warn(`New update available! (${JSON.parse(updateCheckResult.body).version})`)
                        }
                        let updateLaMetric = () => {
                            snek.get(`http://${config.PiHole.IP}/admin/api.php?summary&auth=${config.PiHole.AuthKey}`).then(PiHoleSummaryData => {
                                snek.get(`http://${config.PiHole.IP}/admin/api.php?topItems&auth=${config.PiHole.AuthKey}`).then(PiHoleTopItemsData => {
                                    snek.get(`http://${config.PiHole.IP}/admin/api.php?recentBlocked&auth=${config.PiHole.AuthKey}`).then(PiHoleRecentBlockedData => {
                            availableLaMetrics.forEach(LaMetric => {
                                let updateIndex = 1;
                                let updateSpinner = ora(`Connecting to LaMetric @ ${LaMetric.IP}...`).start();
                                snek.get(`http://${LaMetric.IP}:8080/api/v2/device/apps/com.lametric.58091f88c1c019c8266ccb2ea82e311d`).set('Authorization', `Basic ${Buffer.from(`dev:${LaMetric.AuthKey}`).toString('base64')}`).then(LaMetricDeviceInfo => {
                                    snek.get(`http://${LaMetric.IP}:8080/api/v2/device`).set('Authorization', `Basic ${Buffer.from(`dev:${LaMetric.AuthKey}`).toString('base64')}`).then(LaMetricDeviceInfo2 => {
                                        updateSpinner.text = `Sending update for "${LaMetricDeviceInfo2.body.name}" @ ${LaMetric.IP} to the server...`  
                                        let topQueryArray = Object.values(PiHoleTopItemsData.body.top_queries)  
                                        let topBlockedQueryArray = Object.values(PiHoleTopItemsData.body.top_ads)  
                                        snek.post(`https://lametric.iderp.io/pihole/${LaMetricDeviceInfo2.body.id}`).send({
                                            blockListSize: PiHoleSummaryData.body.domains_being_blocked,
                                            dnsQueriesToday: PiHoleSummaryData.body.dns_queries_today,
                                            adsBlockedToday: PiHoleSummaryData.body.ads_blocked_today,
                                            totalClientsSeen: PiHoleSummaryData.body.clients_ever_seen,
                                            totalDNSQueries: PiHoleSummaryData.body.dns_queries_all_types,
                                            topQuery: `${Object.keys(PiHoleTopItemsData.body.top_queries)[0].toString()} (${topQueryArray[0].toString()} Queries)`,
                                            topBlockedQuery: `${Object.keys(PiHoleTopItemsData.body.top_ads)[0].toString()} (${topBlockedQueryArray[0].toString()} Queries)`,
                                            lastBlockedQuery: "N/A"
                                        }).then(() => {
                                            updateIndex++;
                                            updateSpinner.succeed(`Sent update for "${LaMetricDeviceInfo2.body.name}" @ ${LaMetric.IP} to the server!`)
                                        })
                                    })
                                }).catch(err => {
                                    if (config.debugMode) {
                                        console.log(err)
                                    }
                                    if (err.statusCode != null && err.body.errors != null) {
                                        if (err.statusCode == 401) {
                                            updateSpinner.fail(`Update failed to send for LaMetric @ ${LaMetric.IP}. Auth invalid.`);
                                        } else if (err.statusCode == 404) {
                                            updateSpinner.fail(`Update failed to send for LaMetric @ ${LaMetric.IP}. Pi-Hole Status app not installed on the LaMetric.`);
                                        } else {
                                            updateSpinner.fail(`Update failed to send for LaMetric @ ${LaMetric.IP}. LaMetric does not seem to linked to this IP.`);
                                        }
                                    } else {
                                        updateSpinner.fail(`Update failed to send for LaMetric @ ${LaMetric.IP}. LaMetric does not seem to linked to this IP.`);
                                    }
                                })
                            })
                            }).catch(err => {
                                if (config.debugMode) {
                                    console.log(err)
                                }
                                console.log("Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct.")
                            })
                        }).catch(err => {
                            if (config.debugMode) {
                                console.log(err)
                            }
                            console.log("Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct.")
                        })
                        }).catch(err => {
                            if (config.debugMode) {
                                console.log(err)
                            }
                            console.log("Unable to connect to Pi-Hole via the supplied IP. Make sure that the IP is correct.")
                        })
                        }
                        setInterval(() => {
                            updateLaMetric()
                        }, config.updateInterval * 1000)
                        updateLaMetric()
                    })
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
