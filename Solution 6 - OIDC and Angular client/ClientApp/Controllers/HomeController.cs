using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ClientApp.Controllers
{
    public class HomeController : Controller
    {
        public AppSettings AppSettings { get; }

        public HomeController(AppSettings appSettings)
        {
            AppSettings = appSettings;
        }

        public IActionResult Index()
        {
            return View(AppSettings);
        }

        public IActionResult Error()
        {
            ViewData["RequestId"] = Activity.Current?.Id ?? HttpContext.TraceIdentifier;
            return View();
        }
    }
}
