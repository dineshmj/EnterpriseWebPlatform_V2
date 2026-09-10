using System.IdentityModel.Tokens.Jwt;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

using Duende.AccessTokenManagement.OpenIdConnect;
using Duende.Bff;
using Duende.Bff.Yarp;

using FW.Landscape.Common;
using FW.Landscape.Common.Microservices;

var builder = WebApplication.CreateBuilder(args);

JwtSecurityTokenHandler.DefaultMapInboundClaims = false;
    // 🡡__ WHY   : Prevents the JwtSecurityTokenHandler from remapping JWT claim names (e.g. "sub" -> ClaimTypes.NameIdentifier),
    //              preserving the original JWT/OIDC claim names so downstream code and token-handling logic can rely on consistent claim keys.
    // 🡡__ IF NOT: Claims will be remapped to Microsoft-specific names which can cause mismatch with identity server claims, break role/name lookups,

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
    // 🡡__ WHY   : Session provides a per-user server-side store (ISession) to hold small pieces of state such as temporary UI state, correlation IDs,
    //              or short-lived tokens needed by the BFF. It is simple and sufficient for single-instance or short-lived session needs.
    //              Remember, the Access Token originally obtained during authentication is stored in the authentication cookie by default.
    // 🡡__ IF NOT: Any code or middleware that expects HttpContext.Session will error or return no data, and you lose a convenient place to store per-user server-side state.
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
	    // 🡡__ WHY   : HttpOnly prevents JavaScript access to the session cookie (mitigates XSS theft). Marking cookies Essential ensures cookie consent mechanisms
	    //              don't block them (useful for auth/session cookies that are required for app functionality).
	    // 🡡__ IF NOT: Without HttpOnly the cookie is accessible from JS (increasing XSS risk). If not essential, consent frameworks may suppress session cookies breaking auth flows.
});

builder.Services.AddOpenIdConnectAccessTokenManagement(options =>
    // 🡡__ WHY   : Registers the token management library which automates refresh token handling, caching, and retrieval of access tokens for downstream API calls.
    // 🡡__ IF NOT: You would need to implement token refresh/rotation and secure storage manually in each place you call APIs; tokens may expire unexpectedly.
{
    options.RefreshBeforeExpiration = TimeSpan.FromSeconds(60);
	    // 🡡__ WHY   : Starts the refresh process slightly before token expiry to avoid race conditions and reduce the chance of using an expired token during a request.
	    // 🡡__ IF NOT: Token refresh could happen too late, resulting in failed API calls while a new token is being obtained, and creating poor UX or extra error handling.
});

builder.Services.AddBff()
    .AddRemoteApis();

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = "oidc";
        options.DefaultSignOutScheme = "oidc";
    })
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
    {
        options.Cookie.Name = CookieNames.MICROSERVICE_PRODUCTS_HOST_BFF;
        options.Cookie.Path = "/";
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.Cookie.IsEssential = true;
        options.SlidingExpiration = true;
    })
    .AddOpenIdConnect("oidc", options =>
    {
        options.Authority = IDP.AUTHORITY;
        options.ClientId = ProductsMicroservice.CLIENT_ID_FOR_IDP;
        options.ClientSecret = ProductsMicroservice.CLIENT_SECRET_FOR_IDP;
        options.ResponseType = "code";
        options.ResponseMode = "query";

        options.MapInboundClaims = false;
        options.ClaimActions.MapJsonKey("role", "role", "role");
        options.SaveTokens = true;

        options.Scope.Clear();
        options.Scope.Add("openid");
        options.Scope.Add("profile");
        options.Scope.Add("email");
        options.Scope.Add("roles");

        options.Scope.Add("offline_access");
		    // 🡡__ WHY   : Requests offline_access to allow issuance of refresh tokens so the BFF can silently refresh access tokens for background or long-lived operations.
		    // 🡡__ IF NOT: Without offline_access refresh tokens will not be granted, forcing interactive re-authentication when access tokens expire and preventing seamless background token renewal.

        options.Scope.Add(MicroserviceApiResources.PRODUCTS_API);
		    // 🡡__ WHY   : Adds the microservice-specific API scope so the issued access token contains the permissions required to call the Products API.
		    // 🡡__ IF NOT: Access tokens will not contain the PRODUCTS_API scope and downstream API calls will be rejected with insufficient scope errors (403).

        options.CorrelationCookie.SameSite = SameSiteMode.None;
        options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.Always;
        options.NonceCookie.SameSite = SameSiteMode.None;
        options.NonceCookie.SecurePolicy = CookieSecurePolicy.Always;

        options.GetClaimsFromUserInfoEndpoint = true;
            // 🡡__ WHY   : Some claims (especially custom claims) may not be emitted in the ID token; fetching from the UserInfo endpoint fills out the ClaimsPrincipal reliably.
    		// 🡡__ IF NOT: The created ClaimsPrincipal might miss necessary profile or custom claims, leading to incomplete user context or failed authorization decisions.

        options.TokenValidationParameters.NameClaimType = "name";
        options.TokenValidationParameters.RoleClaimType = "role";

        options.Events.OnAccessDenied = context =>
        {
            return Task.CompletedTask;
        };

        options.Events.OnAuthenticationFailed = context =>
        {
            return Task.CompletedTask;
        };

        options.Events.OnAuthorizationCodeReceived = context =>
        {
            return Task.CompletedTask;
        };

        options.Events.OnMessageReceived = context =>
        {
            return Task.CompletedTask;
        };

        options.Events.OnRedirectToIdentityProvider = context =>
        {
            if (context.Properties.Items.TryGetValue("prompt", out var prompt))
            {
                context.ProtocolMessage.Prompt = prompt;
            }
            return Task.CompletedTask;
        };

        options.Events.OnRedirectToIdentityProviderForSignOut = context =>
        {
            return Task.CompletedTask;
        };

        options.Events.OnRemoteFailure = context =>
        {
            if (context.Failure?.Message?.Contains("login_required") == true ||
                context.Failure?.Message?.Contains("interaction_required") == true)
            {
                context.HandleResponse();

                // Return a page that tells the parent frame authentication is needed
                context.Response.ContentType = "text/html";
                context.Response.WriteAsync(@"
                    <html>
                    <body>
                        <script>
                            window.parent.postMessage({ type: 'AUTH_REQUIRED' }, '*');
                        </script>
                        <p>Authentication required. Please refresh the main application.</p>
                    </body>
                    </html>
                ");
            }
            return Task.CompletedTask;
        };

        options.Events.OnRemoteSignOut = context =>
        {
            return Task.CompletedTask;
        };

        options.Events.OnSignedOutCallbackRedirect = context =>
        {
            return Task.CompletedTask;
        };

        options.Events.OnTicketReceived = context =>
        {
            var isSuccess = context.Success;
            return Task.CompletedTask;
        };

        options.Events.OnTokenResponseReceived = context =>
        {
            // Access the tokens
            var accessToken = context.TokenEndpointResponse.AccessToken;

            var handler = new JwtSecurityTokenHandler();
            var jsonToken = handler.ReadToken(accessToken) as JwtSecurityToken;
            var claims = jsonToken.Claims;
            var audience = jsonToken.Claims.FirstOrDefault(c => c.Type == "aud")?.Value;
            var scope = jsonToken.Claims.FirstOrDefault(c => c.Type == "scope")?.Value;

            // context.HttpContext.Session.SetString("AccessToken", accessToken);
			// 🡡__ WHY   : Persist the current access token in the server-side
            // session so the BFF or handlers can reuse it for proxied API calls or
            // diagnostics.

			// 🡡__ IF NOT: You would need to re-obtain tokens repeatedly or rely
            // solely on authentication properties; proxied calls may lack a
            // readily-available token.

			// 🡡__ NOTE: This is not really required. The HttpContext.
            // GetTokenAsync () call will get you the token on-the-fly, and you
            // do not need to be worried about a stale token. The commented statement
            // is retained for history purpose only.

			return Task.CompletedTask;
        };

        options.Events.OnTokenValidated = context =>
        {
            return Task.CompletedTask;
        };

        options.Events.OnUserInformationReceived = context =>
        {
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();

builder.Services.AddHttpClient(MicroserviceApiResources.PRODUCTS_API, client =>
    // 🡡__ WHY   : Registers a named HttpClient pre-configured with the API base address for the Products API so you can inject/use it from services.
    // 🡡__ IF NOT: You would need to construct HttpClient instances manually and risk misconfiguration, DNS socket exhaustion, or inconsistent base addresses.
{
	client.BaseAddress = new Uri(ProductsMicroservice.MICROSERVICE_API_BASE_URL);
}).AddUserAccessTokenHandler();
// 🡡__ WHY   : Automatically attaches the current user's access token to outgoing HttpClient requests so backend calls execute on behalf of the user.
// 🡡__ IF NOT: You would have to manually retrieve and attach access tokens for each request; missing tokens will cause API authorization failures.

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowShell", policy =>
    {
        policy.WithOrigins(builder.Configuration["ShellOrigin"])
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.UseDeveloperExceptionPage();
else
    app.UseHsts();

app.UseSession();
    // 🡡__ WHY   : Ensures the session middleware is part of the pipeline so ISession-backed values (like cached tokens) are available to request handlers.
    // 🡡__ IF NOT: HttpContext.Session will be unavailable and code relying on session storage will fail or behave unpredictably.

app.UseHttpsRedirection();
app.UseCors("AllowShell");
app.UseDefaultFiles();
app.UseStaticFiles();

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/bff/api"))
    {
        // Rewrite the path to remove /bff
        context.Request.Path = context.Request.Path.Value.Replace("/bff", "");
        context.SetEndpoint(null);
    }
    await next();
});

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseBff();
    // 🡡__ WHY   : Activates the Duende BFF middleware which enforces BFF patterns (cookie-based sessions, CSRF protections, and proxy helpers),
    //             and integrates with the remote API/proxy features that forward requests to backend microservices securely.
    // 🡡__ IF NOT: BFF-specific security features won't be applied and the application will not behave as a properly protected backend-for-frontend.

// Protect all controllers by default except LogoutAllController.
app.MapControllers()
    .RequireAuthorization();
        // 🡡__ WHY   : Enforces authenticated access to controller endpoints by default, applying a secure-by-default model to reduce accidental public exposure.
        // 🡡__ IF NOT: Individual controllers would need per-endpoint [Authorize] attributes; missing protections could unintentionally expose sensitive APIs.

// LogoutAll action method must be public and hence it is not protected by default authorization.
// FIXME: Is this required?
app.MapControllerRoute(
    name: "logout-all",
    pattern: "bff/logout-all/{action=Index}",
    defaults: new { controller = "LogoutAll" }
);

app.MapBffManagementEndpoints();
    // 🡡__ WHY   : Exposes built-in BFF management endpoints (e.g., for remote API management, token inspection, diagnostics) useful for operations and debugging.
    // 🡡__ IF NOT: You lose convenient operational endpoints and tooling provided by the BFF library—diagnostics and runtime management become harder.

//
// Intentionally commented out to enable this Microservice's SPA set directly to the iFrame of the Shell SPA application.
//
// app.MapFallbackToFile("index.html");
//

app.Run();