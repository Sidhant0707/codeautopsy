import Image from "next/image";
import Link from "next/link";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

export default function Footer() {
  return (
    <footer className="py-16 sm:py-20 px-4 sm:px-6 border-t border-white/[0.05] relative z-10 bg-[#080908]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 sm:gap-12 mb-12 sm:mb-16">
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <Image
                src="/codeautopsy-logo1.png"
                alt="Logo"
                width={28}
                height={28}
                className="rounded-sm"
              />
              <span className="text-lg font-bold text-slate-100">
                CodeAutopsy
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              AI-powered codebase analysis for developers who need context
              quickly.
            </p>
          </div>

          {[
            {
              title: "Product",
              links: ["Features", "Pricing", "Docs", "Changelog"],
            },
            {
              title: "Company",
              links: ["About", "Careers", "Contact", "Terms"],
            },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-bold mb-4 sm:mb-6 text-xs uppercase tracking-[0.2em] text-slate-500">
                {col.title}
              </h4>
              <ul className="space-y-3 sm:space-y-4">
                {col.links.map((link) => {
                  const targetPath = ["Features", "Pricing", "About"].includes(
                    link,
                  )
                    ? `/#${link.toLowerCase()}`
                    : `/${link.toLowerCase()}`;
                  return (
                    <li key={link}>
                      <Link
                        href={targetPath}
                        className="text-slate-400 hover:text-white text-sm transition-colors"
                      >
                        {link}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="font-bold mb-4 sm:mb-6 text-xs uppercase tracking-[0.2em] text-slate-500">
              Connect
            </h4>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {[
                {
                  name: "X (Twitter)",
                  Icon: FaXTwitter,
                  href: "https://x.com/SiDHANT0707",
                },
                {
                  name: "GitHub",
                  Icon: FaGithub,
                  href: "https://github.com/Sidhant0707",
                },
                {
                  name: "LinkedIn",
                  Icon: FaLinkedin,
                  href: "https://www.linkedin.com/in/sidhant07",
                },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  title={social.name}
                  className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all flex-shrink-0"
                >
                  <social.Icon className="w-4 h-4" />
                  <span className="sr-only">{social.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-white/[0.05] gap-4 text-center sm:text-left">
          <p className="text-slate-600 text-[10px] sm:text-[11px] uppercase">
            © 2026 CodeAutopsy Inc. All rights reserved.
          </p>
          <p className="text-slate-600 text-[10px] sm:text-[11px] uppercase">
            Engineered for faster codebase comprehension.
          </p>
        </div>
      </div>
    </footer>
  );
}
