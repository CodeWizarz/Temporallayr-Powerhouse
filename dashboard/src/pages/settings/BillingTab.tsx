export default function BillingTab() {
    return (
        <>
            <header className="ch-topbar">
                <div className="ch-topbar-title flex flex-col justify-center">
                    <div className="text-[14px] text-text-primary font-bold">
                        Billing
                    </div>
                </div>
            </header>

            <div className="ch-workspace-scroll">
                <div className="p-8 max-w-5xl mx-auto">

                    {/* Stat Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-20">
                        <div className="card bg-bg-surface border border-border-subtle p-5">
                            <div className="text-[12px] text-text-muted mb-1 font-medium">Plan</div>
                            <div className="flex items-center gap-3">
                                <div className="text-[15px] font-bold text-text-primary">Scale - Trial</div>
                                <div className="text-[12px] text-[#A5D6FF] cursor-pointer hover:underline">Change plan</div>
                            </div>
                        </div>

                        <div className="card bg-bg-surface border border-border-subtle p-5">
                            <div className="text-[12px] text-text-muted mb-1 font-medium">Remaining credits</div>
                            <div className="text-[16px] font-bold text-text-primary">274.05</div>
                        </div>

                        <div className="card bg-bg-surface border border-border-subtle p-5">
                            <div className="text-[12px] text-text-muted mb-1 font-medium">Next invoice due</div>
                            <div className="text-[15px] font-bold text-text-primary">Apr 3, 2026</div>
                        </div>

                        <div className="card bg-bg-surface border border-border-subtle p-5 flex flex-col justify-center relative">
                            <div className="text-[12px] text-text-muted mb-1 font-medium">Billing contact</div>
                            <div className="text-[14px] font-medium text-text-primary truncate pr-6">dveloperbobby@gmail.com</div>
                            <svg className="w-3.5 h-3.5 text-text-muted absolute right-5 top-1/2 -translate-y-1/2 cursor-pointer hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </div>
                    </div>

                    {/* Empty State / Call to Action */}
                    <div className="flex flex-col items-center justify-center py-16 mb-20">
                        <svg className="w-14 h-14 text-white hover:text-white mb-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="2" y="5" width="20" height="14" rx="2" stroke="white" fill="none" />
                            <line x1="2" y1="10" x2="22" y2="10" stroke="white" />
                            <line x1="6" y1="15" x2="10" y2="15" stroke="white" />
                        </svg>
                        <h2 className="text-[18px] font-bold text-text-primary mb-2">Add your credit card</h2>
                        <p className="text-[14px] text-text-muted mb-8 max-w-[320px] text-center tracking-wide leading-relaxed">
                            Add a credit card to continue using ClickHouse once your free trial ends.
                        </p>
                        <button className="ch-btn-yellow !px-6 !py-2.5 !w-auto !text-[14px]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Credit card
                        </button>
                    </div>

                    {/* Accordions */}
                    <div className="border-b border-border-subtle">
                        <button className="flex items-center gap-3 w-full py-4 px-2 text-left hover:bg-white/5 transition-colors group">
                            <svg className="w-4 h-4 text-text-muted transition-transform group-hover:text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            <span className="text-[15px] text-text-primary">Credits</span>
                        </button>

                        <div className="p-4 pt-2 pb-6 animate-in slide-in-from-top-2">
                            <table className="table w-full">
                                <thead>
                                    <tr>
                                        <th className="!text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-border-subtle bg-[#1a1a1a]">Credit validity period</th>
                                        <th className="!text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-border-subtle bg-[#1a1a1a] text-right">Credits granted</th>
                                        <th className="!text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-border-subtle bg-[#1a1a1a] text-right">Credits used</th>
                                        <th className="!text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-border-subtle bg-[#1a1a1a] text-right">Remaining credits</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="hover:!bg-transparent">
                                        <td className="!border-b !py-4 text-[13px] text-text-secondary border-border-subtle">Mar 2 - Apr 2, 2026</td>
                                        <td className="!border-b !py-4 text-[13px] text-text-secondary border-border-subtle text-right">300</td>
                                        <td className="!border-b !py-4 text-[13px] text-text-secondary border-border-subtle text-right">25.95</td>
                                        <td className="!border-b !py-4 text-[13px] text-text-secondary border-border-subtle text-right">274.05</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="text-right mt-3 text-[12px] text-text-muted">
                                <span className="text-accent cursor-pointer hover:underline">Contact us</span> to add more credits
                            </div>
                        </div>
                    </div>

                    <div className="border-b border-border-subtle">
                        <button className="flex items-center gap-3 w-full py-4 px-2 text-left hover:bg-white/5 transition-colors group">
                            <svg className="w-4 h-4 text-text-muted transition-transform group-hover:text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            <span className="text-[15px] text-text-primary">Usage statements</span>
                        </button>
                    </div>

                </div>
            </div>
        </>
    )
}
