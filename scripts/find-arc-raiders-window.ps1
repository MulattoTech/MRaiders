param(
  [Parameter(Mandatory = $false)]
  [string]$WindowTitlePattern = 'Arc Raiders'
)

$signature = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class NativeWindowFinder
{
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    public static List<WindowInfo> FindWindows(string pattern)
    {
        var matches = new List<WindowInfo>();

        EnumWindows((hWnd, lParam) =>
        {
            if (!IsWindowVisible(hWnd))
            {
                return true;
            }

            var titleBuilder = new StringBuilder(512);
            GetWindowText(hWnd, titleBuilder, titleBuilder.Capacity);
            var title = titleBuilder.ToString();

            if (string.IsNullOrWhiteSpace(title))
            {
                return true;
            }

            if (title.IndexOf(pattern, StringComparison.OrdinalIgnoreCase) < 0)
            {
                return true;
            }

            RECT rect;
            if (!GetWindowRect(hWnd, out rect))
            {
                return true;
            }

            var width = rect.Right - rect.Left;
            var height = rect.Bottom - rect.Top;

            if (width < 300 || height < 300)
            {
                return true;
            }

            matches.Add(new WindowInfo
            {
                Handle = hWnd.ToInt64().ToString("X"),
                Title = title,
                X = rect.Left,
                Y = rect.Top,
                Width = width,
                Height = height,
                Area = width * height
            });

            return true;
        }, IntPtr.Zero);

        return matches;
    }
}

public class WindowInfo
{
    public string Handle { get; set; }
    public string Title { get; set; }
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int Area { get; set; }
}
'@

Add-Type -TypeDefinition $signature -Language CSharp | Out-Null

$matches = [NativeWindowFinder]::FindWindows($WindowTitlePattern) |
  Sort-Object -Property Area -Descending

if (-not $matches -or $matches.Count -eq 0) {
  exit 0
}

$best = $matches[0]

[pscustomobject]@{
  handle = $best.Handle
  title = $best.Title
  x = $best.X
  y = $best.Y
  width = $best.Width
  height = $best.Height
} | ConvertTo-Json -Compress
