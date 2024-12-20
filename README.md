# VNDB-Friends-List
The script adds a "friends" link into VNDB's top navigation bar. Clicking it opens a window where you can (you can also close it by clicking on "friends" again):

1. Add friends by typing in their VNDB usernames
2. View your friends list
3. Access friends' profiles quickly
4. Monitor your friends' recent VN ratings in an activity feed
5. See VN cover images on hover in the activity feed

The script also automatically adapts to any VNDB theme for consistent visuals. 

The settings panel allows you to customize:

1. Visual theme (colors, fonts, opacity)
2. Number of VNs shown per friend
3. Maximum activities displayed/recent votes to fetch per friend
4. Cache life duration
5. Font sizes for different elements
6. Export/Import your list

The script uses VNDB's API for data retrieval and localStorage/sessionStorage for persistence. It's made to be lightweight and unobtrusive, while adding valuable social features to enhance the VNDB experience.

To install:

1. Install a userscript manager (like Tampermonkey)
2. Add this script to your userscript manager
3. Visit VNDB and look for the new "friends" link in the top menu on any of your personal user pages
