import { useState } from 'react'

export default function UsageTab() {
    const [activeCategory, setActiveCategory] = useState('compute')

    const getChartHeights = () => {
        if (activeCategory === 'compute') return ['6%', '72%', '15%', '85%', '82%']
        if (activeCategory === 'storage') return ['10%', '15%', '12%', '18%', '16%']
        if (activeCategory === 'backups') return ['2%', '4%', '3%', '5%', '4%']
        if (activeCategory === 'clickpipes') return ['0%', '0%', '0%', '0%', '0%']
        return ['1%', '2%', '1%', '3%', '2%'] // data transfer
    }
    const heights = getChartHeights()
    return (
        <>
            <header className="ch-topbar">
                <div className="ch-topbar-title flex flex-col justify-center">
                    <div className="text-[14px] text-text-primary font-bold">
                        Usage breakdown
                    </div>
                </div>
            </header>

            <div className="ch-workspace-scroll">
                <div className="p-8 max-w-6xl mx-auto">

                    <div className="flex items-center gap-4 mb-8">
                        <div className="text-[13px] font-semibold text-text-primary">Time period</div>
                        <div className="relative">
                            <select className="input bg-[#1e1e1e] border border-border-subtle w-64 appearance-none pr-8 cursor-pointer relative font-medium text-[13px] !py-1.5 focus:border-white/30"
                                style={{
                                    backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='8 10 12 14 16 10'%3e%3c/polyline%3e%3c/svg%3e\")",
                                    backgroundRepeat: "no-repeat",
                                    backgroundPosition: "right 8px center",
                                    backgroundSize: "16px"
                                }}
                            >
                                <option>Mar 2, 2026 to Apr 1, 2026</option>
                                <option>Last 30 days</option>
                                <option>Last month</option>
                            </select>
                        </div>
                    </div>

                    <div className="border border-border-subtle rounded-md bg-[#161616] p-6 mb-8">
                        <div className="flex justify-end mb-8">
                            <div className="flex overflow-hidden rounded-[4px] border border-border-subtle bg-black">
                                <button onClick={() => setActiveCategory('compute')} className={`px-4 py-1.5 text-[12px] font-medium transition-colors ${activeCategory === 'compute' ? 'text-white bg-white/10' : 'text-text-secondary hover:text-white'}`}>Compute</button>
                                <button onClick={() => setActiveCategory('storage')} className={`px-4 py-1.5 text-[12px] font-medium border-l border-border-subtle transition-colors ${activeCategory === 'storage' ? 'text-white bg-white/10' : 'text-text-secondary hover:text-white'}`}>Storage</button>
                                <button onClick={() => setActiveCategory('backups')} className={`px-4 py-1.5 text-[12px] font-medium border-l border-border-subtle transition-colors ${activeCategory === 'backups' ? 'text-white bg-white/10' : 'text-text-secondary hover:text-white'}`}>Backups</button>
                                <button onClick={() => setActiveCategory('clickpipes')} className={`px-4 py-1.5 text-[12px] font-medium border-l border-border-subtle transition-colors ${activeCategory === 'clickpipes' ? 'text-white bg-white/10' : 'text-text-secondary hover:text-white'}`}>ClickPipes</button>
                                <button onClick={() => setActiveCategory('datatransfer')} className={`px-4 py-1.5 text-[12px] font-medium border-l border-border-subtle transition-colors ${activeCategory === 'datatransfer' ? 'text-white bg-white/10' : 'text-text-secondary hover:text-white'}`}>Data transfer</button>
                            </div>
                        </div>

                        {/* Chart Mock */}
                        <div className="h-[240px] relative border-b border-border-subtle mb-10 flex items-end ml-8">
                            {/* Y-axis labels */}
                            <div className="absolute left-[-24px] top-0 bottom-0 flex flex-col justify-between text-[11px] text-text-muted h-full pb-6">
                                <div>10</div>
                                <div>8</div>
                                <div>6</div>
                                <div>4</div>
                                <div>2</div>
                                <div>0</div>
                            </div>

                            {/* Grid lines */}
                            <div className="absolute inset-0 flex flex-col justify-between pb-6 pointer-events-none">
                                <div className="border-t border-white/5 w-full"></div>
                                <div className="border-t border-white/5 w-full"></div>
                                <div className="border-t border-white/5 w-full"></div>
                                <div className="border-t border-white/5 w-full"></div>
                                <div className="border-t border-white/5 w-full"></div>
                                <div className="w-full"></div>
                            </div>

                            {/* Bars & X-axis */}
                            <div className="flex justify-between w-full h-[calc(100%-24px)] px-4">
                                {/* Mar 2 */}
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="w-5 bg-[#3b82f6] rounded-sm transition-all duration-300 group-hover:bg-[#60a5fa]" style={{ height: heights[0] }}></div>
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 2, 2026</div>
                                </div>
                                {/* Mar 4 */}
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="w-5 bg-[#3b82f6] rounded-sm transition-all duration-300 group-hover:bg-[#60a5fa]" style={{ height: heights[1] }}></div>
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 4, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="w-5 bg-[#3b82f6] rounded-sm transition-all duration-300 group-hover:bg-[#60a5fa]" style={{ height: heights[2] }}></div>
                                </div>
                                {/* Mar 6 */}
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="w-5 bg-[#3b82f6] rounded-sm transition-all duration-300 group-hover:bg-[#60a5fa]" style={{ height: heights[3] }}></div>
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 6, 2026</div>
                                </div>
                                {/* Mar 8 */}
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="w-5 bg-[#3b82f6] rounded-sm transition-all duration-300 group-hover:bg-[#60a5fa]" style={{ height: heights[4] }}></div>
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 8, 2026</div>
                                </div>

                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 10, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 12, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 14, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 16, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 18, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 20, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 22, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 24, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 26, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 28, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Mar 30, 2026</div>
                                </div>
                                <div className="relative flex flex-col justify-end items-center h-full group"></div>
                                <div className="relative flex flex-col justify-end items-center h-full group">
                                    <div className="absolute -bottom-10 text-[10px] text-text-muted -rotate-45 whitespace-nowrap origin-top-left ml-5">Apr 1, 2026</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-[12px] text-text-primary mb-4">
                        All usage is displayed at <span className="text-accent cursor-pointer hover:underline">list price <svg className="w-3 h-3 inline-block -mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></span>.
                    </div>

                    <div className="border border-border-subtle rounded-md overflow-hidden bg-[#161616]">
                        <table className="table w-full mb-0">
                            <thead>
                                <tr>
                                    <th className="!py-4 !px-4 !text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-white/10 bg-[#1e1e1e]">Warehouses and services</th>
                                    <th className="!py-4 !px-4 !text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-white/10 bg-[#1e1e1e]">Cloud provider</th>
                                    <th className="!py-4 !px-4 !text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-white/10 bg-[#1e1e1e] text-right">Compute</th>
                                    <th className="!py-4 !px-4 !text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-white/10 bg-[#1e1e1e] text-right">Storage</th>
                                    <th className="!py-4 !px-4 !text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-white/10 bg-[#1e1e1e] text-right">Backups</th>
                                    <th className="!py-4 !px-4 !text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-white/10 bg-[#1e1e1e] text-right">ClickPipes</th>
                                    <th className="!py-4 !px-4 !text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-white/10 bg-[#1e1e1e] text-right">Data transfer</th>
                                    <th className="!py-4 !px-4 !text-[12px] !font-medium !text-text-primary !normal-case !tracking-normal border-b border-white/10 bg-[#1e1e1e] text-right">Total gross usage</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="hover:!bg-white/5 transition-colors">
                                    <td className="!py-6 !px-4 border-b border-white/5 text-[13px] text-text-primary font-medium flex items-center gap-3">
                                        My first service <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    </td>
                                    <td className="!py-6 !px-4 border-b border-white/5 text-[13px]">
                                        <div className="flex items-center">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0112 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115z" /><path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.076 7.076 0 01-6.723-4.823l-4.027 3.115A11.966 11.966 0 0012 24c2.933 0 5.735-1.043 7.834-3l-3.794-2.987z" /><path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21z" /><path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 014.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 000 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067z" /></svg>
                                        </div>
                                    </td>
                                    <td className="!py-6 !px-4 border-b border-white/5 text-[13px] text-text-primary text-right">$25.95</td>
                                    <td className="!py-6 !px-4 border-b border-white/5 text-[13px] text-text-primary text-right">$0.00</td>
                                    <td className="!py-6 !px-4 border-b border-white/5 text-[13px] text-text-primary text-right">$0.00</td>
                                    <td className="!py-6 !px-4 border-b border-white/5 text-[13px] text-text-primary text-right">$0.00</td>
                                    <td className="!py-6 !px-4 border-b border-white/5 text-[13px] text-text-primary text-right">$0.00</td>
                                    <td className="!py-6 !px-4 border-b border-white/5 text-[13px] text-text-primary font-medium text-right">$25.95</td>
                                </tr>
                                <tr className="bg-[#1e1e1e]">
                                    <td className="!py-4 !px-4 font-bold text-[13px] text-text-primary flex items-center gap-1.5 border-b-0">
                                        Total gross usage <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </td>
                                    <td className="!py-4 !px-4 border-b-0"></td>
                                    <td className="!py-4 !px-4 font-bold text-[13px] text-text-primary text-right border-b-0">$25.95</td>
                                    <td className="!py-4 !px-4 font-bold text-[13px] text-text-primary text-right border-b-0">$0.00</td>
                                    <td className="!py-4 !px-4 font-bold text-[13px] text-text-primary text-right border-b-0">$0.00</td>
                                    <td className="!py-4 !px-4 font-bold text-[13px] text-text-primary text-right border-b-0">$0.00</td>
                                    <td className="!py-4 !px-4 font-bold text-[13px] text-text-primary text-right border-b-0">$0.00</td>
                                    <td className="!py-4 !px-4 font-bold text-[13px] text-text-primary text-right border-b-0">$25.95</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>
        </>
    )
}
