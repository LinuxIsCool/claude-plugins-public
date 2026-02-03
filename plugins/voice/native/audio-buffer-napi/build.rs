extern crate napi_build;

fn main() {
  // Check for PipeWire development headers
  #[cfg(target_os = "linux")]
  {
    if std::process::Command::new("pkg-config")
      .args(["--exists", "libpipewire-0.3"])
      .status()
      .map(|s| !s.success())
      .unwrap_or(true)
    {
      println!("cargo:warning=PipeWire development headers not found!");
      println!("cargo:warning=Install with: sudo apt install libpipewire-0.3-dev");
    }
  }

  napi_build::setup();
}
