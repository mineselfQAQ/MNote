**<center><BBBG>算法API_C#</BBBG></center>**

在算法中时常会遇到一些情况需要转化等操作，这里记录一下相应API

---
---
---

# 问题

`"hello<sp><sp>world".Split(' ')`
多一个空字符串，拆分原理：
把分割符看成一杠即可
`hello | | world`

---
---
---

# 数组

注意：string具有不变性，不能直接`[]`访问

## string

- 转换
  - `s.ToLower()`
  - `s.ToUpper()`
  - `s.Trim()`
  - `s.TrimStart()`
  - `s.TrimEnd()`
- 查找
  - `s.Contains("ll")`
  - `s.IndexOf("l")`
  - `s.LastIndexOf("l")`
  - `s.StartsWith("he")`
  - `s.EndsWith("lo")`
- 截取 / 拼接
  - `s.Substring(1, 3)：`从 index=1 开始取 3 个字符 
  - `s.Substring(2)：`从 2 到结尾
  - `string.Concat(s1, s2)`
  - `string.Join(",", arr)`
- 替换
  - `s.Replace("l", "x")`
- 拆分
  - `string[] parts = s.Split(' ');`

## char

- 判断
  - `char.IsLetter(c)`
  - `char.IsDigit(c)`
  - `char.IsLetterOrDigit(c)`
  - `char.IsWhiteSpace(c)`
  - `char.IsUpper(c)`
  - `char.IsLower(c)`
- 转换
  - `char.ToLower(c)`
  - `char.ToUpper(c)`

## 数组

- 排序
  - `Array.Sort(arr)`：默认升序
  - `Array.Reverse(arr)`
- 拷贝
  - `Array.Copy(arr1, arr2, len)`
- 查找
  - `Array.IndexOf(arr, 3)`

## 转换

- `char[] arr = s.ToCharArray();`
- `string newStr = new string(arr);`

<BR>

- `int num = c - '0';`：字符 → 数字
- `char ch = (char)(num + '0');`：数字转字符

<BR>

- `List<int> list = arr.ToList();`（`using System.Linq`）
- `int[] arr = list.ToArray();`

<BR>

- `string s = x.ToString();`
- `string s = Convert.ToString(x);`
- `int x = int.Parse(s);`
- `bool ok = int.TryParse(s, out int x);`
- `int x = Convert.ToInt32("123");`