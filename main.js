#!/usr/bin/env node
'use strict';

var axios = require("axios").default;
require('dotenv').config(); // .env file

const githubUrl = process.argv[2]

axios.defaults.headers.common['Authorization'] = `Token ${process.env.TOKEN}`
const main = async(url) =>{
    const apiUrl = `https://api.github.com/orgs/${url.replace("https://github.com/","")}`

    let orgInfo = (await axios.get(apiUrl).catch(err => console.error(err.message)))?.data

    if(orgInfo == undefined) return
    
    //Basic org info
    console.log("Nombre: " + orgInfo.name)
    console.log("Descripcion: " + orgInfo.description)
    console.log("Enlace: " + orgInfo.blog)

    let repos = []

    let numReposPages = 0
    await axios.get(orgInfo.repos_url+"?per_page=20")
        .then(repo => {
            // console.log(repo.headers)
            numReposPages = parseInt(repo.headers.link?.replace(/.*?(\d+)[^\d]*$/,'$1')) || 1;
            return repos.push(repo.data)
        })
        .catch(err => console.error(err.message + " REPOS CALL"))
    
    for (let index = 2; index <= numReposPages; index++) {
        await getRepos(orgInfo,index).then(repo => {return repos.push(repo)}).catch(err => console.error(err.message + " REPOS CALL"))
    }

    repos = repos.flat()
    // Repos info
    // Since github limits us the number of elements that a response can handle we have to search for the total number of elements
    console.log("Repositorios: ")

    let acumIssues = 0
    let acumCommits = 0

    let reposData=[]

    repos.forEach((repo) => {
        reposData.push(getRepoInfo(repo))
    });

    await Promise.all(reposData).then((reposInfo)=>{
        reposInfo.forEach((repoInfo)=>{
            if(repoInfo){
                console.log("   - " + repoInfo.name);   
                console.log("       · Numero de Issues abiertas: "+ repoInfo.issues);
                console.log("       · Numero de Commits: "+repoInfo.commits)
                acumIssues += repoInfo.issues
                acumCommits += repoInfo.commits
            }
        })
          
    })

    console.log("Total: ");
    console.log("   - Numero de Issues en todos los repositorios " + acumIssues);
    console.log("   - Numero de Commits en todos los repositorios " + acumCommits);  
}

async function getRepos(org,page){

    return axios.get(org.repos_url+"?per_page=20&page="+page)
        .then(repo => {
            return repo.data
        })
        .catch(err => console.error(err.message + " REPOS CALL"))
}

function getRepoInfo(repo){
    let repoInfo = {
        name:repo.name,
        commits:0,
        issues:0
    }
    return axios.get(repo.commits_url.replace("{/sha}","?per_page=1"))
        .then((commits) => {
            // In the commits response there is a header link:
            // <https://api.github.com/repositories/344875330/commits?per_page=1&page=2>; rel="next", 
            // <https://api.github.com/repositories/344875330/commits?per_page=1&page=30>; rel="last"
            // 
            // since the size of the page is 1, the number of pages is the number of commits
            //
            // Getting the last number of this string give us the number of commits
            let numCommits = parseInt(commits.headers.link.replace(/.*?(\d+)[^\d]*$/,'$1')) || 0;

            repoInfo.commits = numCommits;
            return axios.get(repo.pulls_url.replace("{/number}",""))
        })
        //The atribute isseus_open give the number of issues + the number of pullRequest so we have to rest them
        .then((pullsRequest)=>{
            // we filter the open ones
            let openPulls = pullsRequest.data.filter((value)=> value.state == "open")
            let numPulls = openPulls.length;

            repoInfo.issues = repo.open_issues-numPulls;
            return repoInfo;
        })
        .catch(err => {
            if(err.response?.data?.message == "Git Repository is empty."){
                repoInfo.issues = repo.open_issues;
                return repoInfo
            }
            console.error(err.message + repo.name)
        });
}

main(githubUrl)