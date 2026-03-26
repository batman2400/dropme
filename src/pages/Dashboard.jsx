import { Link } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import BottomNavBar from '../components/BottomNavBar';

export default function Dashboard() {
  return (
    <div className="bg-surface text-on-surface font-body min-h-screen pb-32">
      {/* Top App Bar */}
      <header className="w-full pt-12 pb-4 flex justify-between items-center px-6 w-full max-w-screen-xl mx-auto bg-surface">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high">
            <img
              alt="User Profile Avatar"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrfrw6-r56stETRjc6ychcPhnBZfo5yZo5L7PXgXrKm5KGUqUFsf0Zb7gAilk0Els15EJQ6JMxFSIjOKVHI6HVOY-GyLviZniC2SWg3wvIc9UlJdvyLeSk7J9U47jnvWcJt6OOXwlptSZPJlsMw4oZSHWXr1v6wruuzYuqSThHSjSG_LHJR3w_Zgzq4_LZ7cuQ6Cs2kTfX9oQBQcccbCjCS9HQopEBjNwO9Q-XpbX09EKJLAMdo0hes1NaTeV-SoWso7-poe7AYHc"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider font-label">
              Good morning,
            </span>
            <h1 className="text-2xl font-black text-[#0b1c30] font-headline tracking-tight">dropme.</h1>
          </div>
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95">
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </header>

      <main className="px-6 space-y-8 max-w-screen-xl mx-auto">
        {/* Hero Greeting */}
        <section className="mt-4">
          <h2 className="font-headline font-bold text-3xl text-on-surface tracking-tight leading-tight">
            Where to,
            <br />
            <span className="text-primary">Uvaram?</span>
          </h2>
        </section>

        {/* Quick Actions Grid (Asymmetric) */}
        <section className="grid grid-cols-2 gap-4">
          <Link
            to="/find-ride"
            className="flex flex-col justify-between p-6 h-48 bg-primary rounded-[2rem] text-white shadow-xl relative overflow-hidden active:scale-95 transition-transform text-left"
          >
            <div className="z-10 bg-white/20 w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md">
              <span className="material-symbols-outlined">search</span>
            </div>
            <div className="z-10">
              <p className="font-headline font-extrabold text-xl">
                Find a
                <br />
                Ride
              </p>
            </div>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </Link>
          <Link
            to="/offer-ride"
            className="flex flex-col justify-between p-6 h-48 bg-surface-container-highest rounded-[2rem] text-on-surface active:scale-95 transition-transform text-left"
          >
            <div className="bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full">
              <span className="material-symbols-outlined text-primary">steering_wheel_heat</span>
            </div>
            <div>
              <p className="font-headline font-extrabold text-xl text-primary">
                Offer a
                <br />
                Ride
              </p>
            </div>
          </Link>
        </section>

        {/* Live Feed: Rides Near You */}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <h3 className="font-headline font-bold text-xl">Rides Near You</h3>
            <Link to="/ride-matches" className="text-primary font-semibold text-sm font-label uppercase tracking-widest">
              See All
            </Link>
          </div>
          <div className="space-y-4">
            {/* Ride Card 1 */}
            <div className="bg-surface-container-lowest p-5 rounded-[2rem] flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <img
                      alt="Driver 1"
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuARpBTiG1WG82o_wkVg1dT9_u_aur2pErYm6EScmxlXXBJjBESkR8v49oeppuUFhIdmPFdUS4pNbwWA4MKF7sa-I2sl5iZNlgjYIPJEEycc8UMD6x7ojq8re-qVgDRH9tzwXJ24Ghx-oF5QltxRo4HAMIEBUnk2H3k_W-f-EhezjVD6fnRldWdUPRrjQzmHhTgIkR74eyA15inAriee-BUwIXn3DprOFfiWv-svXGEfGc5IkDv1UxKyQZhHRzm8oJQ3br70GCeUzrk"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface">Kasun Perera</h4>
                    <div className="flex items-center gap-1 text-tertiary">
                      <span
                        className="material-symbols-outlined text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        eco
                      </span>
                      <span className="text-[10px] font-bold uppercase font-label">Eco-Driver</span>
                    </div>
                  </div>
                </div>
                <div className="bg-surface-container-low px-3 py-1 rounded-full text-xs font-bold text-primary font-label">
                  08:45 AM
                </div>
              </div>
              <div className="relative pl-6 py-1">
                <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-outline-variant/30 flex flex-col justify-between items-center py-1">
                  <div className="w-2 h-2 rounded-full bg-primary ring-4 ring-primary/10"></div>
                  <div className="w-2 h-2 rounded-full bg-outline-variant"></div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-on-surface-variant">University of Colombo</p>
                  <p className="text-sm font-bold text-on-surface">Nugegoda Junction</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-surface bg-slate-200 overflow-hidden">
                    <img
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDYQisa1aVuNnLaAq-8IrASz5g1ntAHL83dUwivwnka6reEcuYZPWHbXLkeXfFqadguTHrUZ9R6rRVs25jzMtw9z_CfNL8DIkRQLjMu_QWfdFw5G9iP1TxXgL0AizG5L_YJDidJhyBNPse-zdwRdt5qHPDi6CfzX6x0S8EOU0pw23ta3h4Co32ZenqCS_wC-WrnVufxUVftfPKPMDTvITCkqf6hqA1Q6QVERpJ7tchDHzT3CBH0_XScUGYxT3AB-mxTN1rEcuDN0uM"
                      alt="Rider"
                    />
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-surface bg-slate-200 overflow-hidden">
                    <img
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuATZOUXmacqAwizJHMpZEEoeJoU-I2_Iui9iDnd1rK6zHdncsCZR37yQgcypmEHXzJSDYhGklIhOxT0PLq_lkJSoTP6fHjHmGji3U0-XkGcbbWGvsUuCLRvC3g6em6CSVeSH2o5cdmLedH4MFgGh11X777SSoj0wrCmEMc3QhYIc5v9HTZDhCrNTUpFKLnxXrQk3OevHwIoD4M26at0PqmDeU_faqe1HJca2OiMeNQWCadiyz2NWNc8zRq_ZpVnUPfnIaTzdHUiYTI"
                      alt="Rider"
                    />
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
                    +1
                  </div>
                </div>
                <button className="bg-primary-container text-white px-5 py-2.5 rounded-full text-xs font-bold font-label uppercase tracking-widest active:scale-90 transition-transform">
                  Join Ride
                </button>
              </div>
            </div>

            {/* Ride Card 2 */}
            <div className="bg-surface-container-lowest p-5 rounded-[2rem] flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    <img
                      alt="Driver 2"
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7lB2tz33MWVqeWNYml53beTyfNnu1E8yxjTOM8jWap8lwAFGgr9yt88BAqwoGrw2oDoRILSw4qGiVzOTGgtnAc9mGH7IypHS5iFXj02X_t8ttthHrBuOnVq397yHDYB0bYyi0sqtpEZ69Ckgo3Rmrh_rcICF4g3tHMpwFly4Qyrg6fPk2WPJNix49DWUYwjv-0mkg0y687hc8A8AdKWASIXPztoFl2betWBEnMrgJPq5DS9LNnpDXDD7PqEqhxz5ob15Iiivu8Kk"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface">Nadeesha Silva</h4>
                    <div className="flex items-center gap-1 text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">directions_car</span>
                      <span className="text-[10px] font-bold uppercase font-label">Toyota Aqua</span>
                    </div>
                  </div>
                </div>
                <div className="bg-surface-container-low px-3 py-1 rounded-full text-xs font-bold text-primary font-label">
                  09:15 AM
                </div>
              </div>
              <div className="relative pl-6 py-1">
                <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-outline-variant/30 flex flex-col justify-between items-center py-1">
                  <div className="w-2 h-2 rounded-full bg-primary ring-4 ring-primary/10"></div>
                  <div className="w-2 h-2 rounded-full bg-outline-variant"></div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-on-surface-variant">Bambalapitiya</p>
                  <p className="text-sm font-bold text-on-surface">Colombo Fort</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-surface bg-slate-200 overflow-hidden">
                    <img
                      className="w-full h-full object-cover"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0Au3BsKeHUhqwo1bcqOb8xWN1NBB9hiDvDqn6TwN9MNF0leIy20-cYGcF3Cerdd9ZvBivtmjcdZTBDN5DqXJTjdp4gqLquXPEKt_m7KoM_20qSX1Ymz2oOREglXn8wYHca8EJjm_B07_ulvbsLkbnEolWX-xeB76RcIzcz4mfhhR47D6MxOTK8IXgoLHzSh-DaBrPXsSWdKq2OpUUkFxyQNnMmTFtgw7xkniXDEIN54_zv3wLNk74ugONluAXVADxMP2F4VlAsGg"
                      alt="Rider"
                    />
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
                    +2
                  </div>
                </div>
                <button className="bg-primary-container text-white px-5 py-2.5 rounded-full text-xs font-bold font-label uppercase tracking-widest active:scale-90 transition-transform">
                  Join Ride
                </button>
              </div>
            </div>
          </div>
        </section>


      </main>

      <BottomNavBar activeTab="home" />
    </div>
  );
}
