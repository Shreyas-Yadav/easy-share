
import { auth, currentUser } from "@clerk/nextjs/server";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { storage } from "@/utils/firebase";
import { ref } from "firebase/storage";
export default async function Home() {
  const { userId } = await auth();
  const user = await currentUser() as unknown as User;
  
  const storageRef = ref(storage);
 
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
