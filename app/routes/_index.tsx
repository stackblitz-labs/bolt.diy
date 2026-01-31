import type { MetaFunction } from '@remix-run/node';
import { ChefHat, Star, Medal, Utensils } from 'lucide-react';
import { useState } from 'react';

export const meta: MetaFunction = () => {
  return [
    { title: 'K-STREET | 40년 명장의 프리미엄 라면' },
    { name: 'description', content: '40년 집념으로 완성한 단 한 그릇. 문희권 총괄 셰프의 프리미엄 K-라면' },
  ];
};

const MENU_DATA = [
  {
    category: 'Signature',
    items: [
      {
        nameKr: '시그니처 메뉴 1',
        nameVn: 'Món đặc trưng 1',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=800',
        desc: '40년 명장의 혼이 담긴 최고의 시그니처 메뉴입니다.',
      },
      {
        nameKr: '시그니처 메뉴 2',
        nameVn: 'Món đặc trưng 2',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800',
        desc: '엄선된 재료와 비법 육수로 완성한 대표 요리입니다.',
      },
      {
        nameKr: '시그니처 메뉴 3',
        nameVn: 'Món đặc trưng 3',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1591814448473-7f47c215c1c0?q=80&w=800',
        desc: 'K-STREET에서만 맛볼 수 있는 특별한 풍미를 경험하세요.',
      },
      {
        nameKr: '시그니처 메뉴 4',
        nameVn: 'Món đặc trưng 4',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800',
        desc: '장인의 손길로 하나하나 정성껏 준비했습니다.',
      },
    ],
  },
  {
    category: 'Ramen',
    items: [
      {
        nameKr: '라면 메뉴 1',
        nameVn: 'Mì Ramen 1',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1623341214825-9f4f963727da?q=80&w=800',
        desc: '깊고 진한 육수의 맛이 일품인 대표 라면입니다.',
      },
      {
        nameKr: '라면 메뉴 2',
        nameVn: 'Mì Ramen 2',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1557872240-50d2bb80c97a?q=80&w=800',
        desc: '깔끔하고 담백한 맛으로 누구나 즐길 수 있는 라면입니다.',
      },
      {
        nameKr: '라면 메뉴 3',
        nameVn: 'Mì Ramen 3',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800',
        desc: '매콤한 비법 소스가 어우러진 중독성 강한 맛입니다.',
      },
      {
        nameKr: '라면 메뉴 4',
        nameVn: 'Mì Ramen 4',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1591814448473-7f47c215c1c0?q=80&w=800',
        desc: '신선한 해산물이 듬뿍 들어간 시원한 라면입니다.',
      },
      {
        nameKr: '라면 메뉴 5',
        nameVn: 'Mì Ramen 5',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800',
        desc: '고소한 차슈와 면의 조화가 완벽한 라면입니다.',
      },
      {
        nameKr: '라면 메뉴 6',
        nameVn: 'Mì Ramen 6',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=800',
        desc: '셰프의 특별 레시피로 만든 프리미엄 라면입니다.',
      },
    ],
  },
  {
    category: 'Street Food',
    items: [
      {
        nameKr: '분식 메뉴 1',
        nameVn: 'Món ăn đường phố 1',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1534422298391-e4f8c170db06?q=80&w=800',
        desc: '한국 길거리 음식의 정수를 담았습니다.',
      },
      {
        nameKr: '분식 메뉴 2',
        nameVn: 'Món ăn đường phố 2',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1494548162494-384bba4ab999?q=80&w=800',
        desc: '아이부터 어른까지 좋아하는 국민 간식 메뉴입니다.',
      },
      {
        nameKr: '분식 메뉴 3',
        nameVn: 'Món ăn đường phố 3',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?q=80&w=800',
        desc: 'K-STREET 스타일로 재해석한 특별한 맛입니다.',
      },
      {
        nameKr: '분식 메뉴 4',
        nameVn: 'Món ăn đường phố 4',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1544145945-f904253d0c7e?q=80&w=800',
        desc: '바삭하고 고소한 식감이 매력적인 메뉴입니다.',
      },
      {
        nameKr: '분식 메뉴 5',
        nameVn: 'Món ăn đường phố 5',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800',
        desc: '매콤달콤한 소스가 일품인 인기 메뉴입니다.',
      },
      {
        nameKr: '분식 메뉴 6',
        nameVn: 'Món ăn đường phố 6',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1623341214825-9f4f963727da?q=80&w=800',
        desc: '푸짐한 양과 정성이 가득 담긴 요리입니다.',
      },
    ],
  },
  {
    category: 'Korean Food',
    items: [
      {
        nameKr: '한식 요리 1',
        nameVn: 'Món ăn Hàn Quốc 1',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?q=80&w=800',
        desc: '40년 명장의 손맛으로 빚어낸 정통 한식 메뉴입니다.',
      },
      {
        nameKr: '한식 요리 2',
        nameVn: 'Món ăn Hàn Quốc 2',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1544145945-f904253d0c7e?q=80&w=800',
        desc: '깊은 풍미와 정성이 가득 담긴 한국의 맛입니다.',
      },
      {
        nameKr: '한식 요리 3',
        nameVn: 'Món 객 ăn Hàn Quốc 3',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800',
        desc: '엄선된 식재료로 완성한 건강한 한식 차림입니다.',
      },
      {
        nameKr: '한식 요리 4',
        nameVn: 'Món ăn Hàn Quốc 4',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1623341214825-9f4f963727da?q=80&w=800',
        desc: '호치민에서 만나는 프리미엄 한식의 정수입니다.',
      },
    ],
  },
  {
    category: 'Drinks',
    items: [
      {
        nameKr: '음료 1',
        nameVn: 'Đồ uống 1',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1544145945-f904253d0c7e?q=80&w=800',
        desc: '시원하고 청량한 탄산 음료입니다.',
      },
      {
        nameKr: '음료 2',
        nameVn: 'Đồ uống 2',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=800',
        desc: '매장에서 직접 만든 수제 에이드입니다.',
      },
      {
        nameKr: '음료 3',
        nameVn: 'Đồ uống 3',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1623341214825-9f4f963727da?q=80&w=800',
        desc: '요리와 잘 어울리는 엄선된 주류 메뉴입니다.',
      },
      {
        nameKr: '음료 4',
        nameVn: 'Đồ uống 4',
        price: '000,000 VND',
        img: 'https://images.unsplash.com/photo-1552611052-33e04de081de?q=80&w=800',
        desc: '깔끔하게 식사를 마무리해줄 차 메뉴입니다.',
      },
    ],
  },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState('Signature');

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-[#F5EFE7] font-sans selection:bg-[#C6A56A] selection:text-black">
      {/* 1. Global Navigation Bar (GNB) */}
      <nav className="fixed w-full z-50 bg-[#0C0C0C]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* 로고 및 하단 문구 (세로 정렬) */}
          <div className="flex items-center">
            <a href="/" className="flex flex-col items-center no-underline group">
              {/* 로고 이미지 (1.2배 크기) */}
              <div className="relative">
                <img src="/logo.png" alt="K-STREET" className="h-[54px] w-auto block dark:hidden" />

                {/* 다크 모드용 로고: 다크 모드에서는 흰색 로고를 보여줍니다 */}
                <img src="/logo-white.png" alt="K-STREET" className="h-[54px] w-auto hidden dark:block" />
              </div>

              {/* 2. 골드 색상 FOOD CAFE 문구 (PREMIUM DINING 스타일) */}
              <span className="text-[11px] font-serif font-bold tracking-[0.4em] text-[#C6A56A] uppercase mt-0.5 ml-[34px] drop-shadow-[0_1px_2px_rgba(198,165,106,0.3)]">
                {' '}
                Food Cafe
              </span>
            </a>
          </div>

          <div className="hidden md:flex gap-8 text-sm uppercase tracking-widest font-medium text-gray-400">
            <a href="#chef" className="hover:text-[#C6A56A] transition-colors">
              The Master
            </a>
            <a href="#message" className="hover:text-[#C6A56A] transition-colors">
              Greeting
            </a>
            <a href="#menu" className="hover:text-[#C6A56A] transition-colors">
              Menu
            </a>
            <a href="#franchise" className="hover:text-[#C6A56A] transition-colors text-[#7A1F1F]">
              Franchise
            </a>
          </div>

          <div className="flex items-center gap-4">
            <button className="bg-[#C6A56A] text-black px-6 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-[#F5EFE7] transition-all">
              Reserve
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* bg-[url(...)] 이라는 글자가 이 아래에 절대 있으면 안 됩니다. */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-100"
          style={{ backgroundImage: "url('/V-hall.png')" }}
        ></div>

        {/* 배경을 어둡게 눌러주는 레이어 */}
        <div className="absolute inset-0 bg-black/10"></div>

        <div className="relative z-10 text-center px-4">
          <div className="mb-8 opacity-80">
            <span className="text-[#C6A56A] text-sm tracking-[0.8em] uppercase font-bold">Masterpiece</span>
          </div>
          <h1 className="text-6xl md:text-9xl font-serif font-bold mb-8 italic text-[#F5EFE7] leading-tight drop-shadow-2xl">
            Forty Years,
            <br />
            No Compromise.
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light tracking-widest border-t border-white/10 pt-8">
            40년의 집념으로 완성한 단 한 그릇
          </p>
        </div>
      </section>

      {/* 3. Chef Intro */}
      <section id="chef" className="py-32 px-6 bg-[#0C0C0C] border-y border-white/5">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div className="relative group">
            <div className="absolute -inset-4 border border-[#C6A56A]/20 group-hover:border-[#C6A56A]/50 transition-all duration-700"></div>
            <img
              src="/chef1.jpg"
              alt="Chef Mun Hui-kwon"
              className="relative z-10 w-full grayscale hover:grayscale-0 transition-all duration-1000 shadow-2xl object-cover object-top h-[600px]"
            />
          </div>
          <div>
            <div className="inline-block px-4 py-1 border border-[#C6A56A]/40 text-[#C6A56A] text-[10px] tracking-[0.4em] uppercase mb-8 font-bold">
              The Legendary Master
            </div>
            <h2 className="text-6xl font-serif mb-2 text-[#C6A56A] italic">Mun Hui-kwon</h2>
            <h3 className="text-2xl mb-10 text-white font-light tracking-[0.2em]">문희권 총괄 셰프</h3>

            <div className="mb-12 inline-flex items-center gap-6 bg-[#C6A56A]/5 border-y border-[#C6A56A]/20 py-6 px-4 w-full">
              <div className="flex flex-col border-r border-[#C6A56A]/30 pr-8">
                <span className="text-[#C6A56A] text-5xl font-serif font-bold">40</span>
                <span className="text-gray-500 text-[10px] uppercase tracking-tighter">Years Exp.</span>
              </div>
              <p className="text-[#F5EFE7] font-medium leading-relaxed italic">
                "40년은 숫자가 아닌 집념의 시간입니다.
                <br />
                가장 완벽한 한 모금을 위해 타협하지 않습니다."
              </p>
            </div>

            <div className="space-y-6 text-gray-400 text-sm leading-relaxed">
              <div className="flex items-start gap-4 p-4 bg-[#C6A56A]/10 border-l-2 border-[#C6A56A]">
                <Utensils className="text-[#C6A56A] shrink-0" size={24} />
                <div>
                  <p className="font-bold text-[#C6A56A] text-lg">전 D'maris 뷔페 총주방장</p>
                  <p className="text-xs tracking-wider text-[#F5EFE7] opacity-80 uppercase mt-1">
                    푸미흥 · 암푸 · 콩화 매장 총괄 역임
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 px-1">
                <Star className="text-[#C6A56A] shrink-0" size={20} />
                <div>
                  <p className="font-bold text-white text-base">Hilton Hotel & Westin Josun Hotel (30년)</p>
                  <p className="text-xs tracking-wider opacity-80 uppercase mt-0.5">
                    대한민국 최고급 호텔 다이닝 베테랑
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 px-1">
                <ChefHat className="text-[#C6A56A] shrink-0" size={20} />
                <div>
                  <p className="font-bold text-white text-base">청와대 대통령 연회 담당</p>
                  <p className="text-xs tracking-wider opacity-80 uppercase mt-0.5">
                    Blue House Presidential Banquet Director
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 px-1">
                <Medal className="text-[#C6A56A] shrink-0" size={20} />
                <div>
                  <p className="font-bold text-white text-base">국제 요리 대회 은상 수상 (Silver Medal)</p>
                  <p className="text-xs tracking-wider opacity-80 uppercase mt-0.5">
                    대한민국 · 홍콩 · 싱가포르 국제 요리 대회
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ✨ 4. 회사 인사말 (Company Greeting) - 업로드된 가치를 통합한 새로운 섹션 */}
      <section id="message" className="py-32 px-6 bg-[#1A1A1A]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-16 items-start">
            <div className="md:w-1/3">
              <h2 className="text-[#C6A56A] font-serif italic text-4xl mb-6">CEO's Message</h2>
              <div className="w-20 h-px bg-[#C6A56A] mb-8"></div>
              <p className="text-sm tracking-[0.2em] text-gray-500 uppercase font-bold">인사말</p>
            </div>
            <div className="md:w-2/3">
              <div className="mb-10">
                <p className="text-2xl md:text-3xl text-white font-serif italic leading-tight mb-8">
                  "우리는 단순히 음식을 파는 것이 아니라,
                  <br />
                  40년의 세월이 담긴 <span className="text-[#C6A56A]">장인의 진심</span>을 나눕니다."
                </p>
              </div>
              <div className="space-y-6 text-gray-400 leading-relaxed font-light text-lg">
                <p>
                  안녕하십니까, K-STREET 총괄 셰프 문희권입니다. 대한민국 최고급 호텔인 힐튼과 웨스틴 조선에서 보낸
                  30년, 그리고 청와대 대통령 연회를 담당하며 지켜온 원칙은 단 하나입니다.
                  <span className="text-white font-medium"> '가장 정직한 재료가 가장 복잡하고 깊은 맛을 만든다'</span>는
                  믿음입니다.
                </p>
                <p>
                  수만 번의 음식을 조리하며 도달한 그 한 접시의 완성을 위해 우리는 단 1%의 타협도 허용하지 않습니다.
                  베트남 호치민의 푸미흥, 암푸, 콩화에서 쌓아온 현지 식문화에 대한 이해를 바탕으로, 이제 세계가 인정하는
                  프리미엄 K-푸드의 기준을 새롭게 정립하고자 합니다.
                </p>
                <p>
                  K-STREET은 단순한 레스토랑을 넘어, 셰프의 철학이 담긴 공간이자 표준화된 기술력을 통해 지속 가능한
                  비즈니스 모델을 제시하는 파트너가 될 것입니다. 우리의 집념이 담긴 한 그릇이 여러분에게 감동으로
                  전해지길 바랍니다.
                </p>
                <div className="pt-10 flex flex-col items-end">
                  <p className="text-[#C6A56A] font-serif italic text-xl">K-STREET Master Chef</p>
                  <p className="text-white text-2xl font-bold tracking-widest mt-2">Mun Hui-kwon</p>
                  <div className="mt-4 border-b border-[#C6A56A] w-32 opacity-50"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Menu Section */}
      <section id="menu" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-[#C6A56A] font-serif italic text-5xl mb-4">Our Menu</h2>
            <div className="flex justify-center gap-6 md:gap-12 mt-12 border-b border-white/5 pb-6 overflow-x-auto no-scrollbar">
              {MENU_DATA.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => setActiveTab(cat.category)}
                  className={`text-xs uppercase tracking-[0.3em] font-bold whitespace-nowrap transition-all ${activeTab === cat.category ? 'text-[#C6A56A] scale-110' : 'text-gray-600 hover:text-gray-400'}`}
                >
                  {cat.category}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-20">
            {MENU_DATA.find((c) => c.category === activeTab)?.items.map((item, idx) => (
              <div
                key={idx}
                className="group flex flex-col sm:flex-row gap-8 items-center sm:items-start border-b border-white/5 pb-12"
              >
                <div className="w-40 h-40 shrink-0 overflow-hidden border border-[#C6A56A]/20">
                  <img
                    src={item.img}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    alt={item.nameKr}
                  />
                </div>
                <div className="grow w-full">
                  <div className="flex justify-between items-end mb-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[#F5EFE7] text-2xl font-bold tracking-tighter">{item.nameKr}</h3>
                      <p className="text-[#C6A56A] text-xs font-medium uppercase tracking-widest">{item.nameVn}</p>
                    </div>
                    <span className="text-[#C6A56A] font-serif italic text-xl">{item.price}</span>
                  </div>
                  <p className="text-gray-400 text-sm font-light leading-relaxed italic border-l border-[#C6A56A]/30 pl-4">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Franchise Section */}
      <section id="franchise" className="py-32 px-6 bg-[#1A1A1A]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-[#7A1F1F] font-serif text-4xl mb-6 italic">Franchise Partnership</h2>
          <p className="text-gray-400 mb-12 text-sm leading-relaxed">
            40년 명장의 맛을 당신의 도시에 전하세요. <br />
            표준화된 시스템으로 프리미엄 매출을 실현합니다.
          </p>
          <button className="w-full bg-[#7A1F1F] text-white py-5 font-bold uppercase tracking-widest hover:bg-[#F5EFE7] hover:text-black transition-all shadow-xl">
            가맹 상담 신청하기
          </button>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="py-20 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="mb-10">
            <span className="text-3xl font-serif font-bold tracking-[0.3em] text-[#C6A56A]">K-STREET</span>
            <div className="h-px w-20 bg-[#C6A56A]/30 mx-auto mt-4"></div>
          </div>
          <p className="text-gray-700 text-[10px] tracking-[0.5em] uppercase">© 2026 RAMEN CO. MASTER MUN HUI-KWON.</p>
        </div>
      </footer>
    </div>
  );
}
