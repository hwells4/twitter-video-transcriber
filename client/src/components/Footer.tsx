export default function Footer() {
  return (
    <footer className="mt-12 text-center text-sm text-gray-500">
      <p>© {new Date().getFullYear()} Twitter Video Transcriber. All rights reserved.</p>
      <div className="mt-2">
        <a href="#" className="text-primary hover:text-accent">Privacy Policy</a>
        <span className="mx-2">•</span>
        <a href="#" className="text-primary hover:text-accent">Terms of Service</a>
        <span className="mx-2">•</span>
        <a href="#" className="text-primary hover:text-accent">Contact</a>
      </div>
    </footer>
  );
}
