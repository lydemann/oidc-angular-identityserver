using IdentityServer4.Models;
using System.Collections.Generic;

namespace AuthorizationServer
{
    public class Config
    {
        public static IEnumerable<ApiResource> GetApiResources()
        {
            return new List<ApiResource>
        {
            new ApiResource("resourceApi", "API Application")
        };
        }

        public static IEnumerable<Client> GetClients()
        {
            return new List<Client>
        {
            new Client
            {
                ClientId = "clientApp",
 
                // no interactive user, use the clientid/secret for authentication
                AllowedGrantTypes = GrantTypes.ClientCredentials,
 
                // secret for authentication
                ClientSecrets =
                {
                    new Secret("secret".Sha256())
                },
 
                // scopes that client has access to
                AllowedScopes = { "resourceApi" }
            }
        };
        }
    }
}
