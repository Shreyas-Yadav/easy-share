
import { currentUser } from "@clerk/nextjs/server";
import { SignedIn } from "@clerk/nextjs";

export default async function Home() {
  const user = await currentUser();
 
  return (
    <div className="p-6 lg:p-8">
      <SignedIn>
        <div className="max-w-7xl mx-auto ">
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              EasyShare Dashboard
            </h1>
            <p className="text-xl text-gray-600">
              Welcome back, {user?.firstName}! 👋
            </p>
          </div>
        </div>
      </SignedIn>
      
    </div>
  );
}
