using System;
using System.Net.Http;
using System.Threading.Tasks;
using IdentityModel.Client;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace ClientApp.Controllers
{
    [Route("[controller]")]
    public class IdentityController : Controller
    {
        public async Task<IActionResult> Index()
        {
            // discover endpoints from metadata
            var oidcDiscoveryResult = await DiscoveryClient.GetAsync("http://localhost:5000");
            if (oidcDiscoveryResult.IsError)
            {
                Console.WriteLine(oidcDiscoveryResult.Error);
                return Json(oidcDiscoveryResult.Error);
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

            var response = await client.GetAsync("http://localhost:5001/identity");
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine(response.StatusCode);
                throw new HttpRequestException(response.StatusCode.ToString());
            }
            else
            {
                var content = await response.Content.ReadAsStringAsync();
                Console.WriteLine(JArray.Parse(content));
                return Json(content);
            }
        }
    }
}
