using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using ClientApp.Models;
using IdentityModel.Client;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace ClientApp.Controllers
{
    public class IdentityController : Controller
    {
        [Authorize]
        public async Task<IActionResult> Index()
        {
            var userClaimsVM = new UserClaimsVM();
            var userClaimsWithClientCredentials = await GetUserClaimsFromApiWithClientCredentials();
            userClaimsVM.UserClaimsWithClientCredentials = userClaimsWithClientCredentials.IsSuccessStatusCode ? await userClaimsWithClientCredentials.Content.ReadAsStringAsync() : userClaimsWithClientCredentials.StatusCode.ToString();

            var userClaimsWithAccessToken = await CallApiUsingUserAccessToken();
            userClaimsVM.UserClaimsWithAccessToken = userClaimsWithAccessToken.IsSuccessStatusCode ? await userClaimsWithAccessToken.Content.ReadAsStringAsync() : userClaimsWithAccessToken.StatusCode.ToString();

            return View(userClaimsVM);
        }

        private async Task<HttpResponseMessage> GetUserClaimsFromApiWithClientCredentials()
        {
            // discover endpoints from metadata
            var oidcDiscoveryResult = await DiscoveryClient.GetAsync("http://localhost:5000");
            if (oidcDiscoveryResult.IsError)
            {
                Console.WriteLine(oidcDiscoveryResult.Error);
                throw new HttpRequestException(oidcDiscoveryResult.Error);
            }

            // request token
            var tokenClient = new TokenClient(oidcDiscoveryResult.TokenEndpoint, "clientApp", "secret");
            var tokenResponse = await tokenClient.RequestClientCredentialsAsync("resourceApi");

            if (tokenResponse.IsError)
            {
                Console.WriteLine(tokenResponse.Error);
                throw new HttpRequestException(tokenResponse.Error);
            }

            Console.WriteLine(tokenResponse.Json);
            Console.WriteLine("\n\n");

            // call api
            var client = new HttpClient();
            client.SetBearerToken(tokenResponse.AccessToken);

            var response = await client.GetAsync("http://localhost:5001/api/identity");
            return response;
        }

        private async Task<HttpResponseMessage> CallApiUsingUserAccessToken()
        {
            var accessToken = await HttpContext.GetTokenAsync("access_token");

            var client = new HttpClient();
            client.SetBearerToken(accessToken);
            
            return await client.GetAsync("http://localhost:5001/api/identity");
        }

        public async Task Logout()
        {
            await HttpContext.SignOutAsync("Cookies");
            await HttpContext.SignOutAsync("oidc");
        }
    }
}
